import { neon } from '@neondatabase/serverless';

// Server-only: never import this module into src/.
export function getDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not configured');
  return neon(connectionString);
}

export async function checkDatabase() {
  const sql = getDatabase();
  await sql.query('SELECT 1', [], {
    fetchOptions: { signal: AbortSignal.timeout(8_000) },
  });
}

// userId must come exclusively from requireUser(), never from request input.
export function getUserDatabase(userId: string) {
  const connectionString = process.env.RUNTIME_DATABASE_URL;
  if (!connectionString) throw new Error('RUNTIME_DATABASE_URL is not configured');
  const sql = neon(connectionString);
  return {
    async profile(name: string) {
      const results = await sql.transaction([
        sql.query('SET LOCAL ROLE gymlog_app'),
        sql`SELECT set_config('gymlog.user_id', ${userId}, true)`,
        sql`INSERT INTO public.profiles(id,display_name) VALUES (${userId},${name})
          ON CONFLICT (id) DO UPDATE SET id=EXCLUDED.id
          RETURNING id,display_name,timezone,created_at`,
      ]);
      return results[2][0];
    },
  };
}
