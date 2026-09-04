import { neon } from '@neondatabase/serverless'

// Server-only: never import this module into src/.
export function getDatabase() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not configured')
  return neon(connectionString)
}

export async function checkDatabase() {
  const sql = getDatabase()
  await sql.query('SELECT 1', [], {
    fetchOptions: { signal: AbortSignal.timeout(8_000) },
  })
}
