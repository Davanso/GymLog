import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Pool, neonConfig } from '@neondatabase/serverless';

neonConfig.webSocketConstructor = WebSocket;
export function databasePool() {
  const connectionString = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Configure MIGRATION_DATABASE_URL or DATABASE_URL');
  return new Pool({ connectionString, connectionTimeoutMillis: 10000 });
}

export async function migrate() {
  const pool = databasePool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(782913, 1)");
    await client.query(`CREATE TABLE IF NOT EXISTS public.gymlog_migrations (
      name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const applied = new Map((await client.query('SELECT name, checksum FROM public.gymlog_migrations')).rows.map(r => [r.name, r.checksum]));
    const folder = new URL('../database/migrations/', import.meta.url);
    const files = readdirSync(folder).filter(name => /^\d+_.+\.sql$/.test(name)).sort();
    for (const name of applied.keys()) if (!files.includes(name)) throw new Error(`Applied migration missing: ${name}`);
    for (const name of files) {
      const sql = readFileSync(new URL(name, folder), 'utf8');
      const checksum = createHash('sha256').update(sql.replaceAll('\r\n', '\n')).digest('hex');
      if (applied.has(name)) {
        if (applied.get(name) !== checksum) throw new Error(`Applied migration changed: ${name}`);
        console.log(`Already applied: ${name}`);
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO public.gymlog_migrations(name,checksum) VALUES ($1,$2)', [name, checksum]);
      console.log(`Prepared: ${name}`);
    }
    await client.query('COMMIT');
    console.log('Migrations committed successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    // Never print connection strings or complete driver error objects.
    console.error(`Migrations rolled back. ${error.code ? `SQLSTATE ${error.code}: ` : ''}${String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g, '[REDACTED]')}`);
    process.exitCode = 1;
  } finally { client.release(); await pool.end(); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { await migrate(); } catch { console.error('Unable to connect for migrations.'); process.exitCode = 1; }
}
