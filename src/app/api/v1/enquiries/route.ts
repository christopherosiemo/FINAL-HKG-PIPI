import { randomUUID } from 'node:crypto';
import { requireAccess, assertSameOrigin, rateLimit } from '@/lib/access';
import { sql, transaction } from '@/lib/db';
import { DomainError } from '@/lib/domain';

export const runtime = 'nodejs';
function failure(error: unknown) {
  const e = error as Error & { status?: number };
  if (!e.status) console.error('Enquiry operation failed', e.name);
  return Response.json(
    { error: e.status ? e.message : 'This enquiry could not be processed.' },
    { status: e.status ?? 500 },
  );
}
export async function GET(request: Request) {
  try {
    await requireAccess(request, { staff: true });
    const enquiries = await sql(
      "SELECT e.*,COALESCE((SELECT json_agg(json_build_object('id',m.id,'body',m.body,'author_name',m.author_name,'created_at',m.created_at) ORDER BY m.created_at) FROM contact_messages m WHERE m.enquiry_id=e.id),'[]') messages FROM contact_enquiries e ORDER BY e.created_at DESC LIMIT 500",
    );
    return Response.json({ enquiries }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await rateLimit(request, 'admin-enquiry', 30);
    const access = await requireAccess(request, { staff: true }),
      input = await request.json();
    const id = String(input.id ?? ''),
      action = String(input.action ?? ''),
      message = typeof input.message === 'string' ? input.message.trim() : '';
    if (!id || !['reply', 'status'].includes(action))
      throw new DomainError('Choose an enquiry and a valid action.');
    if (action === 'reply' && (!message || message.length > 20000))
      throw new DomainError('A reply between 1 and 20,000 characters is required.');
    if (/(?:AKIA|ASIA)[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(message))
      throw new DomainError('Remove access keys and private keys from this reply.');
    const result = await transaction(async (client) => {
      const enquiry = (
        await client.query('SELECT * FROM contact_enquiries WHERE id=$1 FOR UPDATE', [id])
      ).rows[0];
      if (!enquiry) throw new DomainError('Enquiry not found.', 404);
      if (Number(input.version) !== enquiry.version)
        throw new DomainError('This enquiry changed. Reload before saving.', 409);
      const status = action === 'reply' ? 'responded' : String(input.status ?? enquiry.status);
      if (!['new', 'in_progress', 'responded', 'resolved', 'spam'].includes(status))
        throw new DomainError('Invalid enquiry status.');
      const assigneeId =
        input.assigneeId === ''
          ? null
          : input.assigneeId
            ? String(input.assigneeId)
            : (enquiry.assignee_id ?? access.user.id);
      if (
        assigneeId &&
        !(await client.query('SELECT id FROM "user" WHERE id=$1 AND role=\'admin\'', [assigneeId]))
          .rowCount
      )
        throw new DomainError('The operational owner must be a HKGpipi administrator.');
      if (action === 'reply') {
        await client.query(
          'INSERT INTO contact_messages(id,enquiry_id,body,author_id,author_name) VALUES($1,$2,$3,$4,$5)',
          [randomUUID(), id, message, access.user.id, access.user.name],
        );
        await client.query(
          'INSERT INTO mail_outbox(id,to_email,subject,text_body) VALUES($1,$2,$3,$4)',
          [
            randomUUID(),
            enquiry.email,
            'HKGpipi — reply to your enquiry',
            `${message}\n\nHKGpipi\nEnquiry reference: ${id}\nReply to enquiries@hkgpipi.com for further assistance.`,
          ],
        );
      }
      const updated = (
        await client.query(
          'UPDATE contact_enquiries SET status=$1,assignee_id=$2,version=version+1,updated_at=now() WHERE id=$3 RETURNING *',
          [status, assigneeId, id],
        )
      ).rows[0];
      await client.query(
        'INSERT INTO audit_events(id,actor_id,action,entity_id,detail) VALUES($1,$2,$3,$4,$5)',
        [
          randomUUID(),
          access.user.id,
          `enquiry.${action}`,
          id,
          JSON.stringify({ status, assigneeId, replyRecorded: action === 'reply' }),
        ],
      );
      return { enquiry: updated };
    });
    return Response.json(result);
  } catch (error) {
    return failure(error);
  }
}
