import { Pool, PoolClient } from 'pg';
import { env } from '../config/env';

// Single shared connection pool to the dedicated PostgreSQL server.
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('[pg] idle client error', err);
});

/** Simple query on the pool. */
export function query<T = any>(text: string, params?: any[]) {
  return pool.query<T>(text, params);
}

/**
 * Run work inside a transaction AS a given user, so the existing
 * SECURITY DEFINER SQL functions (which call auth.uid()) resolve to that user.
 *
 * This is the key to reusing GO WATT's hardened money logic without rewriting:
 * we set `request.jwt.claims` = {"sub": userId} for the transaction, exactly as
 * Supabase did — so start_charging_session(), complete_charging_session(),
 * request_payout(), etc. work unchanged.
 */
export async function withUser<T>(
  userId: string | null,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // set_config(..., true) = transaction-scoped; auto-reset on COMMIT/ROLLBACK.
    const claims = userId ? JSON.stringify({ sub: userId }) : JSON.stringify({});
    await client.query("select set_config('request.jwt.claims', $1, true)", [claims]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/** Convenience: call a SQL function as a user and return its single value. */
export async function callFn<T = any>(userId: string | null, sql: string, params: any[] = []): Promise<T> {
  return withUser(userId, async (client) => {
    const { rows } = await client.query(sql, params);
    return rows[0] as T;
  });
}
