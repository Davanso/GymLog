import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { coachStore } from '../../server/coach.js';
import { HttpError } from '../../server/http.js';
import { workoutStore } from '../../server/workouts.js';
import type { Session, TemplateDraft } from '../../shared/workouts.js';

neonConfig.webSocketConstructor = WebSocket;
test('database: coach invitation, immutable assignment, student execution and shared history', async () => {
  const pool = new Pool({
    connectionString: process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
  });
  const db = await pool.connect();
  const previousOrigin = process.env.APP_URL;
  process.env.APP_URL = 'http://localhost:3000';
  try {
    await db.query('BEGIN');
    await db.query('SET CONSTRAINTS profiles_auth_fk DEFERRED');
    const coachId = randomUUID();
    const studentId = randomUUID();
    const extraCoaches = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    await db.query(
      `INSERT INTO profiles(id,display_name) VALUES($1,'Coach teste'),($2,'Aluno teste'),
       ($3,'Coach dois'),($4,'Coach três'),($5,'Coach quatro'),($6,'Coach cinco')`,
      [coachId, studentId, ...extraCoaches],
    );
    await db.query('SET LOCAL ROLE gymlog_app');
    await db.query("SELECT set_config('gymlog.user_id',$1,true)", [coachId]);
    const coach = coachStore(db, coachId);
    await coach.execute({ action: 'enable' });
    const workouts = workoutStore(db, coachId);
    const exercise = (await workouts.dashboard()).exercises.find(
      (item) => item.tracking_mode === 'reps',
    )!;
    const plan: TemplateDraft = {
      id: randomUUID(),
      name: 'Ficha do coach',
      notes: 'Snapshot original',
      restSeconds: 30,
      items: [
        {
          exerciseId: exercise.id,
          sets: 1,
          reps: 10,
          repsMax: 12,
          seconds: null,
          load: 20,
          notes: 'Controle o movimento.',
        },
      ],
    };
    await workouts.execute({ action: 'create', template: plan });
    const invite = (await coach.execute({ action: 'create-invite' })) as { url: string };
    const token = new URL(invite.url).searchParams.get('convite');
    assert.ok(token);

    await db.query("SELECT set_config('gymlog.user_id',$1,true)", [studentId]);
    const studentCoach = coachStore(db, studentId);
    await studentCoach.execute({ action: 'accept-invite', token });
    assert.equal((await studentCoach.dashboard()).coaches[0].name, 'Coach teste');

    await db.query("SELECT set_config('gymlog.user_id',$1,true)", [coachId]);
    const coachDashboard = await coach.dashboard();
    assert.equal(coachDashboard.students[0].name, 'Aluno teste');
    await coach.execute({
      action: 'assign',
      templateId: plan.id,
      version: 1,
      studentIds: [studentId],
      title: 'Semana inicial',
      instructions: 'Instrução geral.',
      recipientInstructions: { [studentId]: 'Priorize a técnica.' },
    });
    await workouts.execute({
      action: 'update',
      version: 1,
      template: { ...plan, name: 'Ficha alterada' },
    });

    await db.query("SELECT set_config('gymlog.user_id',$1,true)", [studentId]);
    const studentWorkouts = workoutStore(db, studentId);
    const received = (await studentWorkouts.dashboard()).received[0];
    assert.equal(received.name, 'Ficha do coach');
    assert.equal(received.instructions, 'Priorize a técnica.');
    let session = (await studentWorkouts.execute({
      action: 'start-assigned',
      id: randomUUID(),
      recipientId: received.recipientId,
    })) as Session;
    assert.equal(session.name, 'Ficha do coach');
    session = (await studentWorkouts.execute({
      action: 'set',
      id: session.id,
      version: session.version,
      setId: session.exercises[0].sets[0].id,
      status: 'completed',
      amount: 11,
      load: 22,
    })) as Session;
    session = (await studentWorkouts.execute({
      action: 'finish',
      id: session.id,
      version: session.version,
    })) as Session;
    assert.equal(session.status, 'completed');

    await db.query("SELECT set_config('gymlog.user_id',$1,true)", [coachId]);
    const history = await coach.studentHistory(studentId);
    assert.equal(history.sessions[0].exercises[0].sets[0].actual_load_kg, 22);
    assert.equal(history.assignments[0].title, 'Semana inicial');
    assert.equal(history.assignments[0].status, 'completed');
    await coach.execute({ action: 'disable' });
    await assert.rejects(
      () => coach.studentHistory(studentId),
      (error: unknown) => error instanceof HttpError && error.status === 403,
    );
    await coach.execute({ action: 'enable' });
    assert.equal((await coach.studentHistory(studentId)).sessions.length, 1);
    await coach.execute({
      action: 'end-relationship',
      id: coachDashboard.students[0].relationshipId,
    });
    await assert.rejects(
      () => coach.studentHistory(studentId),
      (error: unknown) => error instanceof HttpError && error.status === 403,
    );
    await db.query("SELECT set_config('gymlog.user_id',$1,true)", [studentId]);
    assert.equal((await studentWorkouts.dashboard()).received[0].name, 'Ficha do coach');

    const tokens: string[] = [];
    for (const extraCoach of extraCoaches) {
      await db.query("SELECT set_config('gymlog.user_id',$1,true)", [extraCoach]);
      const store = coachStore(db, extraCoach);
      await store.execute({ action: 'enable' });
      const newInvite = (await store.execute({ action: 'create-invite' })) as { url: string };
      tokens.push(new URL(newInvite.url).searchParams.get('convite')!);
    }
    await db.query("SELECT set_config('gymlog.user_id',$1,true)", [studentId]);
    for (const inviteToken of tokens.slice(0, 3))
      await studentCoach.execute({ action: 'accept-invite', token: inviteToken });
    await db.query('SAVEPOINT coach_limit');
    await assert.rejects(
      () => studentCoach.execute({ action: 'accept-invite', token: tokens[3] }),
      (error: unknown) => error instanceof HttpError && error.status === 409,
    );
    await db.query('ROLLBACK TO SAVEPOINT coach_limit');
    await db.query('RELEASE SAVEPOINT coach_limit');
    assert.equal((await studentCoach.dashboard()).coaches.length, 3);
  } finally {
    await db.query('ROLLBACK');
    if (previousOrigin === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = previousOrigin;
    db.release();
    await pool.end();
  }
});
