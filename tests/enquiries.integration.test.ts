import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
vi.mock('../src/lib/access', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/access')>();
  return {
    ...actual,
    requireAccess: async (request: Request) => {
      if (request.headers.get('x-fixture-role') !== 'staff')
        throw Object.assign(new Error('Administrator permission required'), { status: 403 });
      return {
        user: { id: request.headers.get('x-fixture-user'), name: 'Operations fixture' },
        isStaff: true,
      };
    },
  };
});
import { GET, POST } from '../src/app/api/v1/enquiries/route';
import { sql, pool } from '../src/lib/db';
import { appUrl } from '../src/lib/config';
const userId = randomUUID(),
  enquiryId = randomUUID(),
  email = `${enquiryId}@contact.test`;
const req = (method = 'GET', body?: Record<string, unknown>, staff = true, origin = true) =>
  new Request(`${appUrl()}/api/v1/enquiries`, {
    method,
    headers: {
      'x-fixture-role': staff ? 'staff' : 'customer',
      'x-fixture-user': userId,
      'x-real-ip': '127.0.0.55',
      ...(origin ? { origin: appUrl() } : {}),
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
beforeAll(async () => {
  await sql(
    'INSERT INTO "user"(id,name,email,"emailVerified",role,"twoFactorEnabled") VALUES($1,\'Operations fixture\',$2,true,\'admin\',true)',
    [userId, `${userId}@contact.test`],
  );
  await sql(
    "INSERT INTO contact_enquiries(id,name,email,company,message) VALUES($1,'Buyer fixture',$2,'Test company','Please discuss the Savings Sprint')",
    [enquiryId, email],
  );
});
afterAll(async () => {
  await sql('DELETE FROM contact_messages WHERE enquiry_id=$1', [enquiryId]);
  await sql('DELETE FROM contact_enquiries WHERE id=$1', [enquiryId]);
  await sql('DELETE FROM mail_outbox WHERE to_email=$1', [email]);
  await sql('DELETE FROM audit_events WHERE entity_id=$1', [enquiryId]);
  await sql('DELETE FROM "user" WHERE id=$1', [userId]);
  await pool.end();
});
describe('persistent administrator enquiry fulfilment', () => {
  it('restricts the inbox to authenticated administrators', async () => {
    expect((await GET(req('GET', undefined, false))).status).toBe(403);
    const response = await GET(req());
    expect(response.status).toBe(200);
    expect(
      (await response.json()).enquiries.find((e: { id: string }) => e.id === enquiryId),
    ).toMatchObject({ email, status: 'new', version: 1, messages: [] });
  });
  it('persists a reply and queues genuine transactional delivery atomically', async () => {
    const response = await POST(
      req('POST', {
        id: enquiryId,
        version: 1,
        action: 'reply',
        message: 'Thank you. The engagement is a 14-Day AWS Savings Sprint at £5,000.',
      }),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).enquiry).toMatchObject({
      status: 'responded',
      version: 2,
      assignee_id: userId,
    });
    expect(
      (
        await sql<{ count: string }>('SELECT count(*) FROM contact_messages WHERE enquiry_id=$1', [
          enquiryId,
        ])
      )[0].count,
    ).toBe('1');
    expect(
      (
        await sql<{ text_body: string }>('SELECT text_body FROM mail_outbox WHERE to_email=$1', [
          email,
        ])
      )[0].text_body,
    ).toContain('£5,000');
  });
  it('protects versioning and same-origin mutations', async () => {
    expect(
      (await POST(req('POST', { id: enquiryId, version: 1, action: 'status', status: 'resolved' })))
        .status,
    ).toBe(409);
    expect(
      (
        await POST(
          req(
            'POST',
            { id: enquiryId, version: 2, action: 'status', status: 'resolved' },
            true,
            false,
          ),
        )
      ).status,
    ).toBe(403);
    const response = await POST(
      req('POST', { id: enquiryId, version: 2, action: 'status', status: 'resolved' }),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).enquiry.status).toBe('resolved');
  });
});
