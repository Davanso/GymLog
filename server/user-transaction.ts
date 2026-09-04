import { Pool, neonConfig, type PoolClient } from '@neondatabase/serverless';

neonConfig.webSocketConstructor = WebSocket;

// A connection lives only for this request; role and identity never escape the transaction.
export async function userTransaction<T>(userId: string, work: (client: PoolClient) => Promise<T>) {
  const connectionString = process.env.RUNTIME_DATABASE_URL;
  if (!connectionString) throw new Error('Runtime database is not configured');
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 10000 });
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE gymlog_app');
      await client.query("SELECT set_config('gymlog.user_id',$1,true)", [userId]);
      await client.query("SET LOCAL statement_timeout = '10s'");
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}
