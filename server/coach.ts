import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { PoolClient } from '@neondatabase/serverless';
import type { CoachDashboard, StudentHistory } from '../shared/coach.js';
import type { Session } from '../shared/workouts.js';
import { coachAction, coachText, studentIds } from './coachInput.js';
import { appOrigin, HttpError } from './http.js';
import { number, object, uuid } from './workoutInput.js';

const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

export function coachStore(db: PoolClient, userId: string) {
  async function dashboard(): Promise<CoachDashboard> {
    await db.query(
      `UPDATE coach_student_invites SET status='expired',updated_at=now()
       WHERE coach_id=$1 AND status='pending' AND expires_at<=now()`,
      [userId],
    );
    const [coach, students, coaches, invites, templates] = await Promise.all([
      db.query('SELECT disabled_at FROM coach_profiles WHERE profile_id=$1', [userId]),
      db.query(
        `SELECT r.id "relationshipId",p.id "profileId",p.display_name name,r.accepted_at "acceptedAt"
         FROM coach_student_relationships r JOIN profiles p ON p.id=r.student_id
         WHERE r.coach_id=$1 AND r.status='active' ORDER BY p.display_name`,
        [userId],
      ),
      db.query(
        `SELECT r.id "relationshipId",p.id "profileId",p.display_name name,r.accepted_at "acceptedAt"
         FROM coach_student_relationships r JOIN profiles p ON p.id=r.coach_id
         WHERE r.student_id=$1 AND r.status='active' ORDER BY p.display_name`,
        [userId],
      ),
      db.query(
        `SELECT id,status,expires_at "expiresAt",created_at "createdAt" FROM coach_student_invites
         WHERE coach_id=$1 AND status='pending' AND expires_at>now() ORDER BY created_at DESC LIMIT 20`,
        [userId],
      ),
      db.query(
        `SELECT id,name,version FROM workout_templates WHERE user_id=$1 AND archived_at IS NULL ORDER BY position,created_at LIMIT 100`,
        [userId],
      ),
    ]);
    return {
      enabled: Boolean(coach.rows[0] && !coach.rows[0].disabled_at),
      students: students.rows,
      coaches: coaches.rows,
      invites: invites.rows,
      templates: templates.rows,
    };
  }
  async function enable() {
    await db.query(
      `INSERT INTO coach_profiles(profile_id) VALUES($1)
       ON CONFLICT(profile_id) DO UPDATE SET disabled_at=NULL,enabled_at=now(),updated_at=now()`,
      [userId],
    );
    return dashboard();
  }
  async function createInvite() {
    const enabled = await db.query(
      'SELECT 1 FROM coach_profiles WHERE profile_id=$1 AND disabled_at IS NULL',
      [userId],
    );
    if (!enabled.rows[0]) throw new HttpError(409, 'Habilite seu perfil de coach primeiro.');
    const token = randomBytes(32).toString('base64url');
    const id = randomUUID();
    const { rows } = await db.query(
      `INSERT INTO coach_student_invites(id,coach_id,token_hash,expires_at)
       VALUES($1,$2,$3,now()+interval '7 days') RETURNING id,expires_at "expiresAt"`,
      [id, userId, tokenHash(token)],
    );
    return { ...rows[0], url: `${appOrigin()}/app?convite=${encodeURIComponent(token)}` };
  }
  async function disable() {
    const result = await db.query(
      `UPDATE coach_profiles SET disabled_at=now(),updated_at=now()
       WHERE profile_id=$1 AND disabled_at IS NULL RETURNING profile_id`,
      [userId],
    );
    if (!result.rows[0]) throw new HttpError(409, 'Seu perfil de coach já está desabilitado.');
    await db.query(
      `UPDATE coach_student_invites SET status='revoked',revoked_at=now(),updated_at=now()
       WHERE coach_id=$1 AND status='pending'`,
      [userId],
    );
    return dashboard();
  }
  async function acceptInvite(token: unknown) {
    const value = coachText(token, 200, true);
    try {
      const { rows } = await db.query('SELECT gymlog_accept_coach_invite($1) id', [
        tokenHash(value),
      ]);
      return { id: rows[0].id };
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'P0002')
        throw new HttpError(410, 'Este convite expirou ou não está disponível.');
      if (code === '23514') throw new HttpError(409, 'Você já atingiu o limite de três coaches.');
      if (code === '23505') throw new HttpError(409, 'Este coach já está vinculado a você.');
      throw error;
    }
  }
  async function endRelationship(id: unknown) {
    const result = await db.query(
      `UPDATE coach_student_relationships SET status='ended',ended_at=now(),updated_at=now()
       WHERE id=$1 AND status='active' AND (coach_id=$2 OR student_id=$2) RETURNING id`,
      [uuid(id), userId],
    );
    if (!result.rows[0]) throw new HttpError(404, 'Vínculo ativo não encontrado.');
    return { id: result.rows[0].id };
  }
  async function revokeInvite(id: unknown) {
    const result = await db.query(
      `UPDATE coach_student_invites SET status='revoked',revoked_at=now(),updated_at=now()
       WHERE id=$1 AND coach_id=$2 AND status='pending' RETURNING id`,
      [uuid(id), userId],
    );
    if (!result.rows[0]) throw new HttpError(404, 'Convite pendente não encontrado.');
    return { id: result.rows[0].id };
  }
  async function assign(input: Record<string, unknown>) {
    const templateId = uuid(input.templateId);
    const templateVersion = number(input.version, 1, 2147483647);
    const recipients = studentIds(input.studentIds);
    const title = coachText(input.title, 120, true);
    const instructions = coachText(input.instructions ?? '', 2000);
    const recipientInstructions = object(input.recipientInstructions ?? {});
    if (Object.keys(recipientInstructions).some((id) => !recipients.includes(id)))
      throw new HttpError(400, 'Instrução individual sem aluno correspondente.');
    const enabled = await db.query(
      'SELECT 1 FROM coach_profiles WHERE profile_id=$1 AND disabled_at IS NULL',
      [userId],
    );
    if (!enabled.rows[0]) throw new HttpError(409, 'Habilite seu perfil de coach primeiro.');
    const template = await db.query(
      `SELECT id,name,notes,rest_seconds,version FROM workout_templates
       WHERE id=$1 AND user_id=$2 AND archived_at IS NULL FOR UPDATE`,
      [templateId, userId],
    );
    if (!template.rows[0]) throw new HttpError(404, 'Ficha não encontrada.');
    if (template.rows[0].version !== templateVersion)
      throw new HttpError(409, 'A ficha foi alterada. Recarregue antes de atribuir.');
    const relationships = await db.query(
      `SELECT id,student_id FROM coach_student_relationships
       WHERE coach_id=$1 AND student_id=ANY($2::uuid[]) AND status='active'`,
      [userId, recipients],
    );
    if (relationships.rows.length !== recipients.length)
      throw new HttpError(400, 'Todos os alunos precisam ter vínculo ativo.');
    const revision = await db.query(
      'SELECT coalesce(max(revision),0)+1 revision FROM workout_assignment_versions WHERE source_template_id=$1',
      [templateId],
    );
    const versionId = randomUUID();
    await db.query(
      `INSERT INTO workout_assignment_versions(id,coach_id,source_template_id,source_template_version,revision,name,notes,rest_seconds)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        versionId,
        userId,
        templateId,
        templateVersion,
        revision.rows[0].revision,
        template.rows[0].name,
        template.rows[0].notes,
        template.rows[0].rest_seconds,
      ],
    );
    await db.query(
      `INSERT INTO workout_assignment_exercises(id,assignment_version_id,exercise_id,position,notes,exercise_name_snapshot,tracking_mode_snapshot,load_mode_snapshot,load_convention_snapshot)
       SELECT uuidv7(),$1,te.exercise_id,te.position,te.notes,e.name,e.tracking_mode,e.load_mode,e.load_convention
       FROM template_exercises te JOIN exercises e ON e.id=te.exercise_id WHERE te.template_id=$2 AND te.user_id=$3`,
      [versionId, templateId, userId],
    );
    await db.query(
      `INSERT INTO workout_assignment_sets(assignment_exercise_id,position,set_type,target_reps_min,target_reps_max,target_duration_seconds,target_load_kg,rest_seconds)
       SELECT ae.id,ts.position,ts.set_type,ts.target_reps_min,ts.target_reps_max,ts.target_duration_seconds,ts.target_load_kg,ts.rest_seconds
       FROM template_exercises te JOIN template_sets ts ON ts.template_exercise_id=te.id
       JOIN workout_assignment_exercises ae ON ae.assignment_version_id=$1 AND ae.position=te.position
       WHERE te.template_id=$2 AND te.user_id=$3`,
      [versionId, templateId, userId],
    );
    const assignmentId = randomUUID();
    await db.query(
      'INSERT INTO workout_assignments(id,coach_id,assignment_version_id,title,instructions) VALUES($1,$2,$3,$4,$5)',
      [assignmentId, userId, versionId, title, instructions],
    );
    for (const relationship of relationships.rows) {
      await db.query(
        `INSERT INTO workout_assignment_recipients(assignment_id,relationship_id,student_id,instructions)
         VALUES($1,$2,$3,$4)`,
        [
          assignmentId,
          relationship.id,
          relationship.student_id,
          coachText(recipientInstructions[relationship.student_id] ?? '', 2000),
        ],
      );
    }
    return { id: assignmentId, recipients: relationships.rows.length };
  }
  async function studentHistory(studentId: string): Promise<StudentHistory> {
    const relationship = await db.query(
      `SELECT p.display_name FROM coach_student_relationships r JOIN profiles p ON p.id=r.student_id
       JOIN coach_profiles c ON c.profile_id=r.coach_id
       WHERE r.coach_id=$1 AND r.student_id=$2 AND r.status='active' AND r.can_view_history AND c.disabled_at IS NULL`,
      [userId, studentId],
    );
    if (!relationship.rows[0]) throw new HttpError(403, 'Você não pode acessar este aluno.');
    const { rows } = await db.query(
      `SELECT json_build_object('id',w.id,'name',w.name,'version',w.version,'status',w.status,
        'started_at',w.started_at,'ended_at',w.ended_at,'exercises',coalesce((
          SELECT json_agg(json_build_object('id',e.id,'exercise_name_snapshot',e.exercise_name_snapshot,'notes',coalesce(e.notes,''),
            'tracking_mode_snapshot',e.tracking_mode_snapshot,'load_convention_snapshot',e.load_convention_snapshot,
            'sets',coalesce((SELECT json_agg(json_build_object('id',s.id,'position',s.position,
              'target_reps_min',s.target_reps_min,'target_reps_max',s.target_reps_max,'target_duration_seconds',s.target_duration_seconds,
              'target_load_kg',s.target_load_kg::float8,'rest_seconds',s.rest_seconds,'actual_reps',s.actual_reps,
              'actual_duration_seconds',s.actual_duration_seconds,'actual_load_kg',s.actual_load_kg::float8,'status',s.status) ORDER BY s.position)
              FROM session_sets s WHERE s.session_exercise_id=e.id),'[]'::json)) ORDER BY e.position)
          FROM session_exercises e WHERE e.session_id=w.id),'[]'::json)) result
       FROM workout_sessions w WHERE w.user_id=$1 AND w.status<>'in_progress' ORDER BY w.started_at DESC LIMIT 30`,
      [studentId],
    );
    return {
      student: { id: studentId, name: relationship.rows[0].display_name },
      sessions: rows.map((row) => row.result as Session),
    };
  }
  async function execute(raw: unknown) {
    const input = coachAction(raw);
    if (input.action === 'enable') return enable();
    if (input.action === 'disable') return disable();
    if (input.action === 'create-invite') return createInvite();
    if (input.action === 'accept-invite') return acceptInvite(input.token);
    if (input.action === 'revoke-invite') return revokeInvite(input.id);
    if (input.action === 'end-relationship') return endRelationship(input.id);
    if (input.action === 'assign') return assign(input);
    throw new HttpError(400, 'Operação inválida.');
  }
  return { dashboard, studentHistory, execute };
}
