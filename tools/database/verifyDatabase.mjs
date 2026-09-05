import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { databasePool } from './database.mjs';

const pool = databasePool();
let client;
let checks = 0;
async function denied(sql, params, code) {
  await client.query('SAVEPOINT expected_failure');
  let actual;
  try {
    await client.query(sql, params);
  } catch (error) {
    actual = error.code;
  }
  await client.query('ROLLBACK TO SAVEPOINT expected_failure');
  await client.query('RELEASE SAVEPOINT expected_failure');
  assert.equal(actual, code, `Expected SQLSTATE ${code}, received ${actual}`);
  checks++;
}
try {
  client = await pool.connect();
  await client.query('BEGIN');
  // Fake profile identities exist only inside this rolled-back transaction.
  // Never create or modify users in the managed neon_auth schema.
  await client.query('SET CONSTRAINTS profiles_auth_fk DEFERRED');
  const userA = randomUUID(),
    userB = randomUUID();
  const template = randomUUID(),
    item = randomUUID(),
    session = randomUUID(),
    entry = randomUUID();
  const foreignSession = randomUUID(),
    set = randomUUID();
  await client.query(
    "INSERT INTO profiles(id,display_name) VALUES ($1,'Verification A'),($2,'Verification B')",
    [userA, userB],
  );
  await client.query(
    "INSERT INTO workout_sessions(id,user_id,name) VALUES ($1,$2,'Foreign session')",
    [foreignSession, userB],
  );
  const role = (
    await client.query(
      "SELECT rolcanlogin,rolsuper,rolbypassrls FROM pg_roles WHERE rolname='gymlog_app'",
    )
  ).rows[0];
  assert.deepEqual(role, { rolcanlogin: false, rolsuper: false, rolbypassrls: false });
  checks++;
  await client.query('SET LOCAL ROLE gymlog_app');
  assert.equal((await client.query('SELECT count(*)::int AS n FROM profiles')).rows[0].n, 0);
  checks++;
  assert.equal((await client.query('SELECT count(*)::int AS n FROM exercises')).rows[0].n, 0);
  checks++;
  await client.query("SELECT set_config('gymlog.user_id',$1,true)", [userA]);
  assert.equal((await client.query('SELECT count(*)::int AS n FROM profiles')).rows[0].n, 1);
  checks++;
  assert.equal(
    (await client.query('SELECT * FROM workout_sessions WHERE id=$1', [foreignSession])).rowCount,
    0,
  );
  checks++;
  await denied(
    "INSERT INTO workout_templates(user_id,name) VALUES ($1,'Forbidden')",
    [userB],
    '42501',
  );
  await denied("UPDATE equipment SET name='Forbidden' WHERE slug='barra'", [], '42501');
  const exercise = (await client.query("SELECT id FROM exercises WHERE slug='supino-reto-barra'"))
    .rows[0].id;
  await client.query(
    "INSERT INTO workout_templates(id,user_id,name) VALUES ($1,$2,'Original template')",
    [template, userA],
  );
  await client.query(
    'INSERT INTO template_exercises(id,user_id,template_id,exercise_id,position) VALUES ($1,$2,$3,$4,1)',
    [item, userA, template, exercise],
  );
  await client.query(
    'INSERT INTO template_sets(user_id,template_exercise_id,position,target_reps_min,target_reps_max) VALUES ($1,$2,1,8,12)',
    [userA, item],
  );
  await denied(
    'INSERT INTO template_sets(user_id,template_exercise_id,position,target_reps_min,target_reps_max) VALUES ($1,$2,2,12,8)',
    [userA, item],
    '23514',
  );
  await client.query(
    "INSERT INTO workout_sessions(id,user_id,template_id,name) VALUES ($1,$2,$3,'Original template')",
    [session, userA, template],
  );
  await denied(
    "INSERT INTO workout_sessions(user_id,name) VALUES ($1,'Duplicate active')",
    [userA],
    '23505',
  );
  await denied(
    'INSERT INTO session_exercises(user_id,session_id,exercise_id,position) VALUES ($1,$2,$3,1)',
    [userA, foreignSession, exercise],
    '23503',
  );
  await client.query(
    'INSERT INTO session_exercises(id,user_id,session_id,exercise_id,position) VALUES ($1,$2,$3,$4,1)',
    [entry, userA, session, exercise],
  );
  await client.query(
    'INSERT INTO session_sets(id,user_id,session_exercise_id,position,target_reps_min,target_reps_max) VALUES ($1,$2,$3,1,8,12)',
    [set, userA, entry],
  );
  assert.equal(
    (await client.query('SELECT actual_load_kg FROM session_sets WHERE id=$1', [set])).rows[0]
      .actual_load_kg,
    null,
  );
  checks++;
  await denied('UPDATE session_sets SET actual_load_kg=-1 WHERE id=$1', [set], '23514');
  await denied('UPDATE session_sets SET actual_duration_seconds=30 WHERE id=$1', [set], '23514');
  await denied(
    "UPDATE session_sets SET status='completed',completed_at=now() WHERE id=$1",
    [set],
    '23514',
  );
  await client.query('SAVEPOINT incomplete_session');
  await client.query("UPDATE workout_sessions SET status='completed',ended_at=now() WHERE id=$1", [
    session,
  ]);
  await denied('SET CONSTRAINTS completed_session IMMEDIATE', [], '23514');
  await client.query('ROLLBACK TO SAVEPOINT incomplete_session');
  await client.query('RELEASE SAVEPOINT incomplete_session');
  await client.query(
    "UPDATE session_sets SET status='completed',actual_reps=10,actual_load_kg=40,completed_at=now() WHERE id=$1",
    [set],
  );
  await client.query("UPDATE workout_sessions SET status='completed',ended_at=now() WHERE id=$1", [
    session,
  ]);
  await client.query('SET CONSTRAINTS completed_session IMMEDIATE');
  checks++;
  await client.query("UPDATE workout_templates SET name='Edited',archived_at=now() WHERE id=$1", [
    template,
  ]);
  assert.equal(
    (await client.query('SELECT name FROM workout_sessions WHERE id=$1', [session])).rows[0].name,
    'Original template',
  );
  checks++;
  await denied(
    "UPDATE session_exercises SET exercise_name_snapshot='Changed' WHERE id=$1",
    [entry],
    '23514',
  );
  await denied('DELETE FROM session_sets WHERE id=$1', [set], '23514');
  await denied('DELETE FROM workout_templates WHERE id=$1', [template], '23001');
  await client.query('DELETE FROM workout_sessions WHERE id=$1', [session]);
  assert.equal((await client.query('SELECT * FROM session_sets WHERE id=$1', [set])).rowCount, 0);
  checks++;
  await client.query('RESET ROLE');
  // Force the deferred FK check: fake profiles cannot be committed accidentally.
  await denied('SET CONSTRAINTS profiles_auth_fk IMMEDIATE', [], '23503');
  console.log(`${checks} database assertions passed. Fixtures will be rolled back.`);
} catch (error) {
  console.error(
    `Database verification failed (${error.code || error.name}): ${String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g, '[REDACTED]')}`,
  );
  process.exitCode = 1;
} finally {
  if (client) {
    await client.query('ROLLBACK');
    client.release();
  }
  await pool.end();
}
