import { readFileSync } from 'node:fs';
import { databasePool } from './database.mjs';

export async function applySeed(file, label) {
  const pool = databasePool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(782913, 2)');
    await client.query(readFileSync(file, 'utf8'));
    await client.query('COMMIT');
    console.log(`${label} aplicado com sucesso.`);
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
