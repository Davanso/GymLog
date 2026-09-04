import { readFileSync, appendFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { randomBytes } from 'node:crypto';
import { databasePool } from './database.mjs';

// Deliberate provisioning step, never part of application startup/build.
const env = parseEnv(readFileSync('.env', 'utf8'));
if (env.RUNTIME_DATABASE_URL) {
  console.log('RUNTIME_DATABASE_URL already configured. No credential was changed.');
} else {
  const pool = databasePool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const exists = await client.query("SELECT 1 FROM pg_roles WHERE rolname='gymlog_runtime'");
    if (exists.rowCount)
      throw new Error('Runtime role exists. Configure its existing credential manually.');
    const password = randomBytes(40).toString('hex');
    // Password is generated hex, not user input; PostgreSQL DDL cannot bind it.
    await client.query(
      `CREATE ROLE gymlog_runtime LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${password}'`,
    );
    await client.query('GRANT gymlog_app TO gymlog_runtime');
    const url = new URL(env.MIGRATION_DATABASE_URL || env.DATABASE_URL);
    url.username = 'gymlog_runtime';
    url.password = password;
    await client.query('COMMIT');
    appendFileSync(
      '.env',
      `\n# Restricted runtime connection; keep the administrative URL for migrations.\nRUNTIME_DATABASE_URL="${url.href}"\n`,
    );
    console.log('Restricted runtime provisioned. Credential saved only in ignored .env.');
  } catch {
    await client.query('ROLLBACK');
    console.error('Runtime provisioning failed. No credential was printed.');
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}
