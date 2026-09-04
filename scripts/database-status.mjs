import { databasePool } from './database.mjs';

const pool = databasePool();
try {
  const { rows } = await pool.query(
    'SELECT name, applied_at FROM public.gymlog_migrations ORDER BY name',
  );
  for (const row of rows) console.log(`${row.name} — ${row.applied_at.toISOString()}`);
  const counts = await pool.query(`SELECT
    (SELECT count(*)::int FROM public.muscle_groups) AS muscle_groups,
    (SELECT count(*)::int FROM public.equipment) AS equipment,
    (SELECT count(*)::int FROM public.exercises) AS exercises,
    (SELECT count(*)::int FROM public.exercise_media) AS media`);
  console.log('Catalogue:', counts.rows[0]);
} catch {
  console.error(
    'Unable to read migration status. Configure the administrative connection and run db:migrate first.',
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
