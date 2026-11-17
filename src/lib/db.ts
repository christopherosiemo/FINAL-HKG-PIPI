import { Pool, type PoolClient } from 'pg';

const globalDb = globalThis as unknown as { hkgPool?: Pool };
export const pool =
  globalDb.hkgPool ??
  new Pool({
    connectionString:
      process.env.DATABASE_URL ?? 'postgresql://hkgpipi:hkgpipi@127.0.0.1:55432/hkgpipi',
    max: 10,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  });
if (process.env.NODE_ENV !== 'production') globalDb.hkgPool = pool;
export async function sql<T = Record<string, unknown>>(
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  return (await pool.query(text, values)).rows as T[];
}
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
