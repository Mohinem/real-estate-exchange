import { Pool, PoolClient } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export type AuthCtx = { role: 'anonymous'|'app_user'|'app_admin', user_id?: number };

export async function withRlsClient<T>(auth: AuthCtx, fn: (client: PoolClient)=>Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');

    // SET ROLE cannot be parameterized, but we whitelist the values via the type.
    await client.query(`set local role ${auth.role}`);

    // Use set_config() so we can bind parameters safely.
    if (auth.user_id != null) {
      await client.query(`select set_config('jwt.claims.user_id', $1, true)`, [String(auth.user_id)]);
      await client.query(`select set_config('jwt.claims.role', $1, true)`, [auth.role]);
    }
    // If no user_id, we just don't set the claims — current_setting(..., true) will return NULL in RLS checks.

    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
}
