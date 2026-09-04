import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { workoutStore } from '../workouts.js';
import { HttpError } from '../http.js';
import type { Session, TemplateDraft } from '../../shared/workouts.js';

neonConfig.webSocketConstructor = WebSocket;
test('database: tenant isolation, plan CRUD, idempotent start, version conflicts, snapshots and series lifecycle', async () => {
  const pool = new Pool({
    connectionString: process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
  });
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query('SET CONSTRAINTS profiles_auth_fk DEFERRED');
    const userA = randomUUID(),
      userB = randomUUID();
    await db.query(
      "INSERT INTO profiles(id,display_name) VALUES ($1,'Workout test A'),($2,'Workout test B')",
      [userA, userB],
    );
    await db.query('SET LOCAL ROLE gymlog_app');
    await db.query("SELECT set_config('gymlog.user_id',$1,true)", [userA]);
    const store = workoutStore(db, userA);
    const catalog = (await store.dashboard()).exercises;
    const exercise = catalog.find((e) => e.tracking_mode === 'reps')!;
    assert.ok(exercise);
    assert.ok(exercise.muscle_groups.length > 0);
    const plan: TemplateDraft = {
      id: randomUUID(),
      name: 'Verification plan',
      notes: '',
      items: [{ exerciseId: exercise.id, sets: 2, reps: 10, seconds: null, load: 20, rest: 60 }],
    };
    const created = await store.execute({ action: 'create', template: plan });
    assert.equal('version' in created && created.version, 1);
    assert.equal('items' in created && created.items.length, 1);
    await store.execute({ action: 'create', template: plan });
    assert.equal((await store.dashboard()).templates.filter((t) => t.id === plan.id).length, 1);
    const id = randomUUID();
    let workout = (await store.execute({
      action: 'start',
      id,
      templateId: plan.id,
      version: 1,
    })) as Session;
    assert.equal(workout.exercises[0].sets.length, 2);
    assert.equal(workout.exercises[0].sets[0].actual_load_kg, null);
    assert.equal(
      ((await store.execute({ action: 'start', id, templateId: plan.id, version: 1 })) as Session)
        .id,
      id,
    );
    const denied = async (job: () => Promise<unknown>, status: number) =>
      assert.rejects(job, (e: unknown) => e instanceof HttpError && e.status === status);
    await denied(
      () => store.execute({ action: 'start', id: randomUUID(), templateId: plan.id, version: 1 }),
      409,
    );
    await store.execute({
      action: 'update',
      version: 1,
      template: { ...plan, name: 'Changed', items: [{ ...plan.items[0], sets: 3, load: 30 }] },
    });
    assert.equal((await store.session(id)).name, 'Verification plan');
    assert.equal((await store.session(id)).exercises[0].sets.length, 2);
    assert.equal((await store.session(id)).exercises[0].sets[0].target_load_kg, 20);
    await denied(() => store.execute({ action: 'update', version: 1, template: plan }), 409);
    await denied(() => store.execute({ action: 'finish', id, version: 1 }), 400);
    const [first, second] = workout.exercises[0].sets;
    workout = (await store.execute({
      action: 'set',
      id,
      version: 1,
      setId: first.id,
      status: 'completed',
      amount: 12,
      load: 0,
    })) as Session;
    assert.equal(workout.version, 2);
    assert.equal(workout.exercises[0].sets[0].actual_load_kg, 0);
    await denied(
      () =>
        store.execute({
          action: 'set',
          id,
          version: 1,
          setId: second.id,
          status: 'completed',
          amount: 8,
          load: 10,
        }),
      409,
    );
    await denied(() => store.execute({ action: 'finish', id, version: 2 }), 400);
    await db.query("SELECT set_config('gymlog.user_id',$1,true)", [userB]);
    const other = workoutStore(db, userB);
    assert.equal((await other.dashboard()).templates.length, 0);
    await denied(() => other.session(id), 404);
    await denied(() => other.execute({ action: 'archive', id: plan.id, version: 2 }), 404);
    await denied(
      () =>
        other.execute({
          action: 'set',
          id,
          version: 2,
          setId: second.id,
          status: 'completed',
          amount: 8,
          load: 10,
        }),
      404,
    );
    await db.query("SELECT set_config('gymlog.user_id',$1,true)", [userA]);
    workout = (await store.execute({
      action: 'set',
      id,
      version: 2,
      setId: second.id,
      status: 'skipped',
    })) as Session;
    workout = (await store.execute({ action: 'finish', id, version: workout.version })) as Session;
    assert.equal(workout.status, 'completed');
    await denied(
      () =>
        store.execute({
          action: 'set',
          id,
          version: workout.version,
          setId: second.id,
          status: 'completed',
          amount: 8,
          load: 10,
        }),
      409,
    );
    await store.execute({ action: 'archive', id: plan.id, version: 2 });
    assert.equal((await store.dashboard()).templates.filter((t) => t.id === plan.id).length, 0);
    assert.equal((await store.session(id)).exercises[0].sets[0].actual_reps, 12);
    assert.equal((await store.dashboard()).active, null);
    const duration = catalog.find((e) => e.tracking_mode === 'duration')!;
    assert.ok(duration);
    const timed = {
      ...plan,
      id: randomUUID(),
      items: [{ ...plan.items[0], exerciseId: duration.id, sets: 1, reps: null, seconds: 30 }],
    };
    await store.execute({ action: 'create', template: timed });
    let timedSession = (await store.execute({
      action: 'start',
      id: randomUUID(),
      templateId: timed.id,
      version: 1,
    })) as Session;
    timedSession = (await store.execute({
      action: 'set',
      id: timedSession.id,
      version: 1,
      setId: timedSession.exercises[0].sets[0].id,
      status: 'completed',
      amount: 45,
      load: 0,
    })) as Session;
    assert.equal(timedSession.exercises[0].sets[0].actual_duration_seconds, 45);
    assert.equal(timedSession.exercises[0].sets[0].actual_reps, null);
    timedSession = (await store.execute({
      action: 'cancel',
      id: timedSession.id,
      version: 2,
    })) as Session;
    assert.equal(timedSession.status, 'cancelled');
    assert.equal(timedSession.exercises[0].sets[0].actual_duration_seconds, 45);
    await db.query('SET CONSTRAINTS completed_session IMMEDIATE');
  } finally {
    await db.query('ROLLBACK');
    db.release();
    await pool.end();
  }
});
