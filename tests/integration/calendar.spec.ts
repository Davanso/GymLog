import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { calendarStore } from '../../server/calendar.js';
import { reportsStore } from '../../server/reports.js';
import { workoutStore } from '../../server/workouts.js';
import type { TemplateDraft } from '../../shared/workouts.js';

neonConfig.webSocketConstructor = WebSocket;

test('database: personal schedule can be saved and generates calendar occurrences', async () => {
  const pool = new Pool({
    connectionString: process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
  });
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query('SET CONSTRAINTS profiles_auth_fk DEFERRED');
    const userId = randomUUID();
    await db.query("INSERT INTO profiles(id,display_name) VALUES($1,'Atleta calendário')", [
      userId,
    ]);
    await db.query('SET LOCAL ROLE gymlog_app');
    await db.query("SELECT set_config('gymlog.user_id',$1,true)", [userId]);

    const workouts = workoutStore(db, userId);
    const exercise = (await workouts.dashboard()).exercises.find(
      (item) => item.tracking_mode === 'reps',
    )!;
    const template: TemplateDraft = {
      id: randomUUID(),
      name: 'Treino agendado',
      notes: '',
      restSeconds: 60,
      items: [
        {
          exerciseId: exercise.id,
          sets: 3,
          reps: 10,
          repsMax: 10,
          seconds: null,
          load: 0,
          notes: '',
        },
      ],
    };
    await workouts.execute({ action: 'create', template });
    const otherTemplate = { ...template, id: randomUUID(), name: 'Outro treino' };
    await workouts.execute({ action: 'create', template: otherTemplate });

    const calendar = calendarStore(db, userId);
    await calendar.execute({
      action: 'save-schedule',
      source: 'personal',
      sourceId: template.id,
      subjectId: userId,
      weekdays: [1, 3],
      startsOn: '2026-09-01',
    });
    const dashboard = await calendar.dashboard('2026-09');

    assert.deepEqual(dashboard.schedules.find((item) => item.id === template.id)?.weekdays, [1, 3]);
    assert.ok(
      dashboard.days.some((day) => day.events.some((event) => event.name === template.name)),
    );

    const report = await reportsStore(db, userId).dashboard('month', '2026-09-11');
    assert.equal(report.days.length, 30);
    assert.ok(report.summary.planned > 0);
    assert.equal(report.summary.completedSessions, 0);
    assert.equal(report.summary.adherence, 0);
    assert.equal(report.subject.id, userId);

    await db.query('SAVEPOINT duplicate_weekday');
    await assert.rejects(
      () =>
        calendar.execute({
          action: 'save-schedule',
          source: 'personal',
          sourceId: otherTemplate.id,
          subjectId: userId,
          weekdays: [1],
          startsOn: '2026-09-01',
        }),
      (error: unknown) => (error as { code?: string }).code === '23505',
    );
    await db.query('ROLLBACK TO SAVEPOINT duplicate_weekday');
    await db.query('RELEASE SAVEPOINT duplicate_weekday');
  } finally {
    await db.query('ROLLBACK');
    db.release();
    await pool.end();
  }
});
