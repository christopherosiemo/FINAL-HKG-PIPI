import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { getQueue } from '../src/lib/jobs';
import { sql, pool } from '../src/lib/db';
const name = `integration-${randomUUID()}`;
let boss: Awaited<ReturnType<typeof getQueue>>, jobId: string;
beforeAll(async () => {
  boss = await getQueue();
  await boss.createQueue(name, { retryLimit: 0, deadLetter: 'failed-jobs' });
});
afterAll(async () => {
  await sql('DELETE FROM jobs.job WHERE name=$1 OR source_name=$1', [name]);
  await boss.deleteQueue(name);
  await boss.stop();
  await pool.end();
});
describe('durable PostgreSQL job lifecycle', () => {
  it('persists work and exposes exhausted failures through dead letters', async () => {
    jobId = (await boss.send(name, { kind: 'integration-proof' }))!;
    expect(jobId).toBeTruthy();
    const jobs = await boss.fetch<{ kind: string }>(name);
    expect(jobs[0].data.kind).toBe('integration-proof');
    await boss.fail(name, jobs[0].id, { message: 'Intentional offline test failure' });
    const original = await boss.getJobById(name, jobId);
    expect(original?.state).toBe('failed');
    const copies = await sql<{ source_id: string; source_name: string }>(
      "SELECT source_id,source_name FROM jobs.job WHERE name='failed-jobs' AND source_id=$1",
      [jobId],
    );
    expect(copies[0]).toMatchObject({ source_id: jobId, source_name: name });
  });
  it('supports explicit retry without duplicating the original job', async () => {
    expect((await boss.retry(name, jobId)).affected).toBe(1);
    const jobs = await boss.fetch(name);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].id).toBe(jobId);
    await boss.complete(name, jobId);
    expect((await boss.getJobById(name, jobId))?.state).toBe('completed');
  });
});
