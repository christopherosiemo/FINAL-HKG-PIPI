import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:net';
import { resolve, sep } from 'node:path';
import { rm } from 'node:fs/promises';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
vi.mock('../src/lib/access', async () => {
  const { sql } = await import('../src/lib/db');
  return {
    requireAccess: async (request: Request, options: { organisationId: string }) => {
      const userId = request.headers.get('x-fixture-user');
      const user = (
        await sql<{ id: string; role: string }>('SELECT id,role FROM "user" WHERE id=$1', [userId])
      )[0];
      if (!user) throw Object.assign(new Error('Sign in'), { status: 401 });
      const member = (
        await sql<{ role: string }>(
          'SELECT role FROM "member" WHERE "userId"=$1 AND "organizationId"=$2',
          [userId, options.organisationId],
        )
      )[0];
      if (!member && user.role !== 'admin')
        throw Object.assign(new Error('Not found'), { status: 404 });
      return { user, isStaff: user.role === 'admin', organisationRole: member?.role ?? null };
    },
  };
});
vi.mock('../src/lib/jobs', () => ({ enqueueJob: vi.fn(async () => 'test-job-id') }));
import { sql, pool } from '../src/lib/db';
import { uploadFile, downloadFile, scanFile } from '../src/lib/storage';
import { enqueueJob } from '../src/lib/jobs';
const ids = {
  customer: randomUUID(),
  other: randomUUID(),
  staff: randomUUID(),
  org: randomUUID(),
  otherOrg: randomUUID(),
};
const storageDir = resolve('.data', `storage-integration-${randomUUID()}`);
let server: Server;
const original = {
  provider: process.env.FILE_STORAGE_PROVIDER,
  path: process.env.FILE_STORAGE_PATH,
  host: process.env.CLAMAV_HOST,
  port: process.env.CLAMAV_PORT,
};
let uploadedId = '';
const request = (actor: keyof typeof ids) =>
  new Request('http://localhost/api/v1/files', { headers: { 'x-fixture-user': ids[actor] } });
beforeAll(async () => {
  for (const actor of ['customer', 'other', 'staff'] as const)
    await sql('INSERT INTO "user"(id,name,email,"emailVerified",role) VALUES($1,$2,$3,true,$4)', [
      ids[actor],
      actor,
      `${ids[actor]}@files.test`,
      actor === 'staff' ? 'admin' : 'customer',
    ]);
  await sql(
    "INSERT INTO \"organization\"(id,name,slug) VALUES($1,'File test',$1),($2,'Other file test',$2)",
    [ids.org, ids.otherOrg],
  );
  await sql(
    'INSERT INTO "member"(id,"organizationId","userId",role) VALUES($1,$2,$3,\'owner\'),($4,$5,$6,\'owner\')',
    [randomUUID(), ids.org, ids.customer, randomUUID(), ids.otherOrg, ids.other],
  );
  process.env.FILE_STORAGE_PROVIDER = 'local';
  process.env.FILE_STORAGE_PATH = storageDir;
  server = createServer((socket) => {
    let pending = Buffer.alloc(0),
      command = false;
    socket.on('data', (chunk) => {
      pending = Buffer.concat([pending, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
      if (!command) {
        if (pending.length < 10) return;
        pending = pending.subarray(10);
        command = true;
      }
      while (pending.length >= 4) {
        const n = pending.readUInt32BE(0);
        if (pending.length < n + 4) return;
        pending = pending.subarray(4);
        if (n === 0) {
          socket.end('stream: OK\0');
          return;
        }
        pending = pending.subarray(n);
      }
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  process.env.CLAMAV_HOST = '127.0.0.1';
  process.env.CLAMAV_PORT = String((server.address() as { port: number }).port);
});
afterAll(async () => {
  await sql(
    'DELETE FROM record_revisions WHERE record_id IN (SELECT id FROM records WHERE organisation_id=$1)',
    [ids.org],
  );
  await sql('DELETE FROM records WHERE organisation_id=$1', [ids.org]);
  await sql('DELETE FROM files WHERE organisation_id IN ($1,$2)', [ids.org, ids.otherOrg]);
  await sql('DELETE FROM audit_events WHERE organisation_id IN ($1,$2)', [ids.org, ids.otherOrg]);
  await sql('DELETE FROM "member" WHERE "organizationId" IN ($1,$2)', [ids.org, ids.otherOrg]);
  await sql('DELETE FROM "organization" WHERE id IN ($1,$2)', [ids.org, ids.otherOrg]);
  await sql('DELETE FROM "user" WHERE id IN ($1,$2,$3)', [ids.customer, ids.other, ids.staff]);
  await pool.end();
  await new Promise<void>((r) => server.close(() => r()));
  if (!storageDir.startsWith(resolve('.data') + sep)) throw new Error('Unsafe test cleanup path');
  await rm(storageDir, { recursive: true, force: true });
  for (const [key, value] of Object.entries({
    FILE_STORAGE_PROVIDER: original.provider,
    FILE_STORAGE_PATH: original.path,
    CLAMAV_HOST: original.host,
    CLAMAV_PORT: original.port,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
describe('persistent private file upload, quarantine and authorisation', () => {
  it('stores real bytes privately and queues scanning before download', async () => {
    const form = new FormData();
    form.set('organisationId', ids.org);
    form.set('file', new File(['service,cost\nEC2,200'], 'billing.csv', { type: 'text/csv' }));
    const req = new Request('http://localhost/api/v1/files', {
      method: 'POST',
      headers: { 'x-fixture-user': ids.customer },
      body: form,
    });
    const result = await uploadFile(req);
    uploadedId = result.file.id;
    expect(result.file.status).toBe('quarantined');
    expect(enqueueJob).toHaveBeenCalledWith('file-scan', { fileId: uploadedId });
    await expect(downloadFile(request('customer'), uploadedId)).rejects.toMatchObject({
      status: 409,
    });
  });
  it('requires a conclusive scanner result and denies another organisation', async () => {
    await scanFile(uploadedId);
    expect(
      (await sql<{ status: string }>('SELECT status FROM files WHERE id=$1', [uploadedId]))[0]
        .status,
    ).toBe('clean');
    await expect(downloadFile(request('other'), uploadedId)).rejects.toMatchObject({ status: 404 });
    const response = await downloadFile(request('customer'), uploadedId);
    expect(await response.text()).toContain('EC2,200');
    expect(response.headers.get('content-disposition')).toContain('attachment');
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('does not expose an internal staff document before explicit publication', async () => {
    await sql('UPDATE files SET uploaded_by=$1 WHERE id=$2', [ids.staff, uploadedId]);
    await expect(downloadFile(request('customer'), uploadedId)).rejects.toMatchObject({
      status: 403,
    });
    await sql(
      "INSERT INTO records(id,organisation_id,kind,title,status,data,created_by) VALUES($1,$2,'deliverable','Reviewed billing export','published',$3,$4)",
      [
        randomUUID(),
        ids.org,
        JSON.stringify({ fileId: uploadedId, visibility: 'customer' }),
        ids.staff,
      ],
    );
    expect((await downloadFile(request('customer'), uploadedId)).status).toBe(200);
  });
});
