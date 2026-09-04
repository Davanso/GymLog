import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { databasePool } from './database.mjs';

export async function seedCuratedExercises() {
  const pool = databasePool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(782913, 2)');
    await client.query(
      readFileSync(
        new URL('../database/seeds/001_curated_exercises_pt_br.sql', import.meta.url),
        'utf8',
      ),
    );
    await client.query('COMMIT');
    console.log('Seed curado pt-BR aplicado com sucesso.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(
      `Seed revertido. ${error.code ? `SQLSTATE ${error.code}: ` : ''}${String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g, '[REDACTED]')}`,
    );
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await seedCuratedExercises();
  } catch {
    console.error('Não foi possível conectar para aplicar o seed.');
    process.exitCode = 1;
  }
}
