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
    // Set role + claims; use LOCAL so it auto-resets on commit
    await client.query(`set local role ${auth.role}`);
    if (auth.user_id != null) {
      await client.query(`set local "jwt.claims.user_id" = $1`, [String(auth.user_id)]);
      await client.query(`set local "jwt.claims.role" = $1`, [auth.role]);
    } else {
      await client.query(`set local "jwt.claims.user_id" to default`);
      await client.query(`set local "jwt.claims.role" to default`);
    }
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
