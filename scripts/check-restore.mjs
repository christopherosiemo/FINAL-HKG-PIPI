import 'dotenv/config';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';

// Local acceptance check only. Never restores over the source database.
const url = new URL(
  process.env.DATABASE_URL || 'postgresql://hkgpipi:hkgpipi@127.0.0.1:55432/hkgpipi',
);
if (
  process.env.NODE_ENV === 'production' ||
  !['127.0.0.1', 'localhost'].includes(url.hostname) ||
  url.pathname !== '/hkgpipi'
)
  throw new Error('This fixture restore check requires the local hkgpipi development database.');
const container = 'final-hkg-pipi-postgres-1';
const restored = `hkgpipi_restore_${Date.now()}`;
const source = new pg.Pool({ connectionString: url.toString() });
const copyUrl = new URL(url);
copyUrl.pathname = `/${restored}`;
const target = new pg.Pool({ connectionString: copyUrl.toString() });
const quote = (value) => `"${value.replaceAll('"', '""')}"`;
function docker(args, input) {
  return new Promise((accept, reject) => {
    const process = spawn('docker', ['exec', ...(input ? ['-i'] : []), container, ...args], {
      windowsHide: true,
    });
    const chunks = [],
      errors = [];
    process.stdout.on('data', (chunk) => chunks.push(chunk));
    process.stderr.on('data', (chunk) => errors.push(chunk));
    process.on('error', reject);
    process.on('close', (code) =>
      code === 0
        ? accept(Buffer.concat(chunks))
        : reject(new Error(`Database utility failed (${code}): ${Buffer.concat(errors)}`)),
    );
    process.stdin.end(input);
  });
}
const snapshot = await source.connect();
try {
  await snapshot.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const {
    rows: [exported],
  } = await snapshot.query('SELECT pg_export_snapshot() AS id');
  const { rows: tables } = await snapshot.query(
    "SELECT schemaname,tablename FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema') ORDER BY 1,2",
  );
  const counts = [];
  for (const table of tables) {
    const tableName = `${quote(table.schemaname)}.${quote(table.tablename)}`;
    const {
      rows: [row],
    } = await snapshot.query(`SELECT count(*)::text AS count FROM ${tableName}`);
    counts.push({ tableName, count: row.count });
  }
  const backup = await docker([
    'pg_dump',
    '-U',
    'hkgpipi',
    '-d',
    'hkgpipi',
    '-Fc',
    '--snapshot',
    exported.id,
  ]);
  await snapshot.query('COMMIT');
  await mkdir(resolve('work'), { recursive: true });
  await writeFile(resolve('work/local-acceptance-backup.dump'), backup);
  await source.query(`CREATE DATABASE ${quote(restored)}`);
  await docker(
    ['pg_restore', '-U', 'hkgpipi', '-d', restored, '--no-owner', '--exit-on-error'],
    backup,
  );
  for (const table of counts) {
    const {
      rows: [row],
    } = await target.query(`SELECT count(*)::text AS count FROM ${table.tableName}`);
    if (row.count !== table.count)
      throw new Error(`Restored row count differs for ${table.tableName}`);
  }
  const report = {
    verifiedAt: new Date().toISOString(),
    isolatedDatabase: restored,
    tablesCompared: counts.length,
    bytes: backup.length,
    result:
      'All restored table row counts match the exported source snapshot. Source database unchanged.',
  };
  await writeFile(resolve('work/restore-result.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await snapshot.query('ROLLBACK').catch(() => {});
  snapshot.release();
  await Promise.all([source.end(), target.end()]);
}
