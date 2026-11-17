import { randomUUID } from 'node:crypto';
import { assertSameOrigin, requireAccess, rateLimit } from '@/lib/access';
import { sql } from '@/lib/db';
import { getQueue, enqueueJob } from '@/lib/jobs';
import { DomainError } from '@/lib/domain';
export const runtime = 'nodejs';
function failure(error: unknown) {
  const e = error as Error & { status?: number };
  if (!e.status) console.error('Operations request failed', e.name);
  return Response.json(
    { error: e.status ? e.message : 'The operational request could not be completed.' },
    { status: e.status ?? 500 },
  );
}
export async function GET(request: Request) {
  try {
    await requireAccess(request, { staff: true });
    await getQueue();
    const [mail, files, jobs] = await Promise.all([
      sql(
        "SELECT id,to_email,subject,status,attempts,last_error,next_attempt_at,created_at FROM mail_outbox WHERE status!='sent' ORDER BY created_at DESC LIMIT 100",
      ),
      sql(
        "SELECT id,organisation_id,filename,status,scan_error,created_at FROM files WHERE status!='clean' ORDER BY created_at DESC LIMIT 100",
      ),
      sql(
        "SELECT id,name,state,retry_count,created_on,completed_on,output,source_name,source_id,source_output FROM jobs.job WHERE state='failed' OR (name='failed-jobs' AND state NOT IN ('cancelled','completed')) ORDER BY created_on DESC LIMIT 100",
      ),
    ]);
    return Response.json(
      { mail, files, jobs },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await rateLimit(request, 'operations-retry', 30);
    const access = await requireAccess(request, { staff: true });
    const body = await request.json(),
      id = String(body.id ?? ''),
      action = String(body.action ?? '');
    if (!id) throw new DomainError('Select an operational record.');
    if (action === 'retryMail') {
      if (
        !(
          await sql(
            "UPDATE mail_outbox SET attempts=0,last_error=null,status='pending',next_attempt_at=now() WHERE id=$1 AND status!='sent' RETURNING id",
            [id],
          )
        ).length
      )
        throw new DomainError('Queued message not found.', 404);
    } else if (action === 'retryScan') {
      const file = (await sql<{ status: string }>('SELECT status FROM files WHERE id=$1', [id]))[0];
      if (!file || file.status === 'rejected')
        throw new DomainError(
          'Rejected files must be uploaded again; quarantined files can be retried.',
        );
      await enqueueJob('file-scan', { fileId: id });
    } else if (action === 'retryJob') {
      let name = String(body.name ?? ''),
        jobId = id;
      if (name === 'failed-jobs') {
        const source = (
          await sql<{ source_name: string; source_id: string }>(
            "SELECT source_name,source_id FROM jobs.job WHERE id=$1 AND name='failed-jobs'",
            [id],
          )
        )[0];
        if (!source) throw new DomainError('Dead-letter record not found.', 404);
        name = source.source_name;
        jobId = source.source_id;
      }
      if (!['aws-sync', 'file-scan', 'payment-reconcile'].includes(name))
        throw new DomainError('Unsupported queue.');
      const boss = await getQueue(),
        result = await boss.retry(name, jobId);
      if (!result.affected)
        throw new DomainError(
          'This job is already running, completed, or unavailable for retry.',
          409,
        );
      const copies = await sql<{ id: string }>(
        "SELECT id FROM jobs.job WHERE name='failed-jobs' AND source_id=$1",
        [jobId],
      );
      for (const copy of copies) await boss.cancel('failed-jobs', copy.id);
    } else throw new DomainError('Unsupported operational action.');
    await sql('INSERT INTO audit_events(id,actor_id,action,entity_id) VALUES($1,$2,$3,$4)', [
      randomUUID(),
      access.user.id,
      `operations.${action}`,
      id,
    ]);
    return Response.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
