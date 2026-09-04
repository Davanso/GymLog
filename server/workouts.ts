import { randomUUID } from 'node:crypto';
import type { PoolClient } from '@neondatabase/serverless';
import type {
  Exercise,
  Session,
  SessionExercise,
  Template,
  TemplateDraft,
  WorkoutDashboard,
} from '../shared/workouts.js';
import { HttpError } from './http.js';
import { draft, loadKg, number, object, uuid } from './workout-input.js';

export function workoutStore(db: PoolClient, userId: string) {
  async function templates(): Promise<Template[]> {
    const { rows } = await db.query(
      `SELECT id,name,coalesce(notes,'') notes,version,rest_seconds AS "restSeconds" FROM workout_templates WHERE user_id=$1 AND archived_at IS NULL ORDER BY position,created_at LIMIT 100`,
      [userId],
    );
    const items = await db.query(
      `SELECT te.template_id, te.exercise_id, count(s.id)::int sets,
      min(s.target_reps_min) reps,min(s.target_duration_seconds) seconds,min(s.target_load_kg)::float8 load
      FROM template_exercises te JOIN template_sets s ON s.template_exercise_id=te.id
      WHERE te.user_id=$1 AND te.template_id=ANY($2::uuid[]) GROUP BY te.id ORDER BY te.position`,
      [userId, rows.map((r) => r.id)],
    );
    return rows.map((r) => ({
      ...r,
      items: items.rows
        .filter((i) => i.template_id === r.id)
        .map((i) => ({
          exerciseId: i.exercise_id,
          sets: i.sets,
          reps: i.reps,
          seconds: i.seconds,
          load: i.load,
        })),
    })) as Template[];
  }
  async function session(id: string): Promise<Session> {
    const { rows } = await db.query(
      `SELECT json_build_object('id',w.id,'name',w.name,'version',w.version,'status',w.status,
        'started_at',w.started_at,'ended_at',w.ended_at,'exercises',coalesce((
          SELECT json_agg(json_build_object('id',e.id,'exercise_name_snapshot',e.exercise_name_snapshot,
            'tracking_mode_snapshot',e.tracking_mode_snapshot,'load_convention_snapshot',e.load_convention_snapshot,
            'external_id',(SELECT external_id FROM exercises WHERE id=e.exercise_id),
            'image_url',(SELECT url FROM exercise_media WHERE exercise_id=e.exercise_id AND kind='image' ORDER BY position LIMIT 1),
            'video_url',(SELECT url FROM exercise_media WHERE exercise_id=e.exercise_id AND kind='video' ORDER BY position LIMIT 1),
            'sets',coalesce((SELECT json_agg(json_build_object('id',s.id,'position',s.position,
              'target_reps_min',s.target_reps_min,'target_duration_seconds',s.target_duration_seconds,
              'target_load_kg',s.target_load_kg::float8,'rest_seconds',s.rest_seconds,
              'actual_reps',s.actual_reps,'actual_duration_seconds',s.actual_duration_seconds,
              'actual_load_kg',s.actual_load_kg::float8,'status',s.status) ORDER BY s.position)
              FROM session_sets s WHERE s.session_exercise_id=e.id AND s.user_id=$2),'[]'::json)) ORDER BY e.position)
          FROM session_exercises e WHERE e.session_id=w.id AND e.user_id=$2),'[]'::json)) result
       FROM workout_sessions w WHERE w.id=$1 AND w.user_id=$2`,
      [id, userId],
    );
    if (!rows[0]) throw new HttpError(404, 'Treino não encontrado.');
    return rows[0].result as Session;
  }
  async function dashboard(): Promise<WorkoutDashboard> {
    const exercises = await db.query(
      `SELECT e.id,e.name,q.name equipment,e.tracking_mode,e.load_mode,e.load_convention,e.external_id,
        (SELECT md.url FROM exercise_media md WHERE md.exercise_id=e.id AND md.kind='image' ORDER BY md.position LIMIT 1) image_url,
        (SELECT md.url FROM exercise_media md WHERE md.exercise_id=e.id AND md.kind='video' ORDER BY md.position LIMIT 1) video_url,
        ARRAY(SELECT m.name::text FROM exercise_muscles em JOIN muscle_groups m ON m.id=em.muscle_group_id
          WHERE em.exercise_id=e.id ORDER BY em.role,m.name) AS muscle_groups
        FROM exercises e JOIN equipment q ON q.id=e.equipment_id WHERE e.archived_at IS NULL ORDER BY e.name`,
    );
    const active = await db.query(
      "SELECT id FROM workout_sessions WHERE user_id=$1 AND status='in_progress'",
      [userId],
    );
    const recent = await db.query(
      "SELECT id,name,status,started_at,ended_at FROM workout_sessions WHERE user_id=$1 AND status <> 'in_progress' ORDER BY started_at DESC LIMIT 20",
      [userId],
    );
    return {
      exercises: exercises.rows as Exercise[],
      templates: await templates(),
      active: active.rows[0] ? await session(active.rows[0].id) : null,
      recent: recent.rows,
    };
  }
  async function lockTemplate(id: string, version: number) {
    const { rows } = await db.query(
      'SELECT * FROM workout_templates WHERE id=$1 AND user_id=$2 AND archived_at IS NULL FOR UPDATE',
      [id, userId],
    );
    if (!rows[0]) throw new HttpError(404, 'Ficha não encontrada.');
    if (rows[0].version !== version)
      throw new HttpError(409, 'Esta ficha mudou em outra aba. Recarregue antes de editar.');
    return rows[0];
  }
  async function save(plan: TemplateDraft, version?: number) {
    // Serialize creates/retries for this user as well as the active-session invariant.
    await db.query('SELECT id FROM profiles WHERE id=$1 FOR UPDATE', [userId]);
    if (version === undefined) {
      const existing = (await templates()).find((t) => t.id === plan.id);
      if (existing) {
        const saved = {
          id: existing.id,
          name: existing.name,
          notes: existing.notes,
          restSeconds: existing.restSeconds,
          items: existing.items,
        };
        if (JSON.stringify(saved) !== JSON.stringify(plan))
          throw new HttpError(409, 'Identificador de ficha já utilizado.');
        return existing;
      }
      const count = await db.query(
        'SELECT count(*)::int n FROM workout_templates WHERE user_id=$1 AND archived_at IS NULL',
        [userId],
      );
      if (count.rows[0].n >= 100)
        throw new HttpError(400, 'Limite de 100 fichas. Exclua uma ficha antes de criar outra.');
    } else await lockTemplate(plan.id, version);
    const catalog = await db.query(
      'SELECT id,tracking_mode FROM exercises WHERE id=ANY($1::uuid[]) AND archived_at IS NULL',
      [plan.items.map((i) => i.exerciseId)],
    );
    for (const item of plan.items) {
      const exercise = catalog.rows.find((e) => e.id === item.exerciseId);
      if (!exercise || (exercise.tracking_mode === 'reps') !== (item.reps !== null))
        throw new HttpError(400, 'Exercício indisponível ou meta incompatível.');
    }
    if (version === undefined)
      await db.query(
        'INSERT INTO workout_templates(id,user_id,name,notes,rest_seconds) VALUES ($1,$2,$3,$4,$5)',
        [plan.id, userId, plan.name, plan.notes, plan.restSeconds],
      );
    else {
      await db.query(
        'UPDATE workout_templates SET name=$3,notes=$4,rest_seconds=$5,version=version+1 WHERE id=$1 AND user_id=$2',
        [plan.id, userId, plan.name, plan.notes, plan.restSeconds],
      );
      await db.query('DELETE FROM template_exercises WHERE template_id=$1 AND user_id=$2', [
        plan.id,
        userId,
      ]);
    }
    for (const [index, item] of plan.items.entries()) {
      const id = randomUUID();
      await db.query(
        'INSERT INTO template_exercises(id,user_id,template_id,exercise_id,position) VALUES ($1,$2,$3,$4,$5)',
        [id, userId, plan.id, item.exerciseId, index + 1],
      );
      await db.query(
        `INSERT INTO template_sets(user_id,template_exercise_id,position,target_reps_min,target_reps_max,target_duration_seconds,target_load_kg,rest_seconds)
        SELECT $1,$2,n,$4,$4,$5,$6,$7 FROM generate_series(1,$3::int) n`,
        [userId, id, item.sets, item.reps, item.seconds, item.load, plan.restSeconds],
      );
    }
    return { ...plan, version: version === undefined ? 1 : version + 1 };
  }
  async function start(id: string, templateId: string, version: number) {
    await db.query('SELECT id FROM profiles WHERE id=$1 FOR UPDATE', [userId]);
    const existing = await db.query(
      'SELECT id,template_id FROM workout_sessions WHERE id=$1 AND user_id=$2',
      [id, userId],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].template_id !== templateId)
        throw new HttpError(409, 'Identificador já utilizado.');
      return session(id);
    }
    if (
      (
        await db.query(
          "SELECT id FROM workout_sessions WHERE user_id=$1 AND status='in_progress'",
          [userId],
        )
      ).rows[0]
    )
      throw new HttpError(
        409,
        'Você já tem um treino em andamento. Retome ou encerre esse treino.',
      );
    const template = await lockTemplate(templateId, version);
    const items = await db.query(
      `SELECT te.*,t.rest_seconds FROM template_exercises te JOIN workout_templates t ON t.id=te.template_id WHERE te.template_id=$1 AND te.user_id=$2 ORDER BY te.position`,
      [templateId, userId],
    );
    if (!items.rows.length)
      throw new HttpError(400, 'Adicione exercícios à ficha antes de iniciar.');
    await db.query(
      'INSERT INTO workout_sessions(id,user_id,template_id,name,notes) VALUES ($1,$2,$3,$4,$5)',
      [id, userId, templateId, template.name, template.notes],
    );
    await db.query(
      `INSERT INTO session_exercises(id,user_id,session_id,exercise_id,position,notes)
       SELECT uuidv7(),user_id,$1,exercise_id,position,notes FROM template_exercises
       WHERE template_id=$2 AND user_id=$3 ORDER BY position`,
      [id, templateId, userId],
    );
    await db.query(
      `INSERT INTO session_sets(user_id,session_exercise_id,position,set_type,target_reps_min,target_reps_max,target_duration_seconds,target_load_kg,rest_seconds)
       SELECT ts.user_id,se.id,ts.position,ts.set_type,ts.target_reps_min,ts.target_reps_max,
         ts.target_duration_seconds,ts.target_load_kg,t.rest_seconds
       FROM template_exercises te JOIN template_sets ts ON ts.template_exercise_id=te.id
       JOIN session_exercises se ON se.session_id=$1 AND se.position=te.position
       JOIN workout_templates t ON t.id=te.template_id
       WHERE te.template_id=$2 AND te.user_id=$3`,
      [id, templateId, userId],
    );
    return session(id);
  }
  async function changeSession(input: Record<string, unknown>) {
    const id = uuid(input.id),
      version = number(input.version, 1, 2147483647);
    const locked = await db.query(
      'SELECT version,status FROM workout_sessions WHERE id=$1 AND user_id=$2 FOR UPDATE',
      [id, userId],
    );
    if (!locked.rows[0]) throw new HttpError(404, 'Treino não encontrado.');
    if (locked.rows[0].version !== version)
      throw new HttpError(409, 'O treino mudou em outra aba. Recarregue para continuar.');
    if (locked.rows[0].status !== 'in_progress')
      throw new HttpError(409, 'Este treino já foi encerrado.');
    if (input.action === 'set') {
      const setId = uuid(input.setId);
      const row = await db.query(
        `SELECT s.status,e.tracking_mode_snapshot FROM session_sets s JOIN session_exercises e ON e.id=s.session_exercise_id WHERE s.id=$1 AND e.session_id=$2 AND s.user_id=$3`,
        [setId, id, userId],
      );
      if (!row.rows[0]) throw new HttpError(404, 'Série não encontrada.');
      if (row.rows[0].status !== 'pending')
        throw new HttpError(409, 'Esta série já foi registrada.');
      if (!['completed', 'skipped'].includes(String(input.status)))
        throw new HttpError(400, 'Estado de série inválido.');
      const done = input.status === 'completed';
      const amount = done
        ? number(input.amount, 1, row.rows[0].tracking_mode_snapshot === 'reps' ? 1000 : 86400)
        : null;
      const load = done ? loadKg(input.load) : null;
      await db.query(
        `UPDATE session_sets SET status=$3,actual_reps=$4,actual_duration_seconds=$5,actual_load_kg=$6,completed_at=CASE WHEN $3='completed' THEN now() ELSE NULL END WHERE id=$1 AND user_id=$2`,
        [
          setId,
          userId,
          input.status,
          row.rows[0].tracking_mode_snapshot === 'reps' ? amount : null,
          row.rows[0].tracking_mode_snapshot === 'duration' ? amount : null,
          load,
        ],
      );
    } else if (input.action === 'finish' || input.action === 'cancel') {
      if (input.action === 'finish') {
        const state = await session(id);
        const sets = state.exercises.flatMap((e: SessionExercise) => e.sets);
        if (!sets.some((s) => s.status === 'completed') || sets.some((s) => s.status === 'pending'))
          throw new HttpError(
            400,
            'Conclua ao menos uma série e conclua ou pule todas as pendentes.',
          );
      }
      await db.query(
        'UPDATE workout_sessions SET status=$3,ended_at=now() WHERE id=$1 AND user_id=$2',
        [id, userId, input.action === 'finish' ? 'completed' : 'cancelled'],
      );
    } else throw new HttpError(400, 'Operação inválida.');
    await db.query('UPDATE workout_sessions SET version=version+1 WHERE id=$1 AND user_id=$2', [
      id,
      userId,
    ]);
    return session(id);
  }
  async function execute(raw: unknown) {
    const input = object(raw);
    switch (input.action) {
      case 'create':
        return save(draft(input.template));
      case 'update':
        return save(draft(input.template), number(input.version, 1, 2147483647));
      case 'archive': {
        const id = uuid(input.id);
        await lockTemplate(id, number(input.version, 1, 2147483647));
        // Archive so past and active sessions retain their source reference.
        await db.query(
          'UPDATE workout_templates SET archived_at=now(),version=version+1 WHERE id=$1 AND user_id=$2',
          [id, userId],
        );
        return { id };
      }
      case 'start':
        return start(uuid(input.id), uuid(input.templateId), number(input.version, 1, 2147483647));
      default:
        return changeSession(input);
    }
  }
  return { dashboard, session, execute };
}
