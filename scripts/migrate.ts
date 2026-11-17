import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pool, transaction } from '../src/lib/db';
async function main() {
  await pool.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())',
  );
  for (const name of (await readdir(resolve('migrations')))
    .filter((n) => n.endsWith('.sql'))
    .sort()) {
    await transaction(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(73519063)');
      if ((await c.query('SELECT name FROM schema_migrations WHERE name=$1', [name])).rowCount)
        return;
      await c.query(await readFile(resolve('migrations', name), 'utf8'));
      await c.query('INSERT INTO schema_migrations(name) VALUES($1)', [name]);
      console.log(`Applied ${name}`);
    });
  }
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
