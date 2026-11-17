import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { apiError, assertSameOrigin, rateLimit, AccessError } from '@/lib/access';
import { transaction } from '@/lib/db';
const schema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().max(254),
  company: z.string().trim().min(2).max(160),
  message: z.string().trim().min(20).max(4000),
  website: z.string().max(0).optional(),
});
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await rateLimit(request, 'contact', 3, 300);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success)
      throw new AccessError(
        'Enter your name, work email, company and a message of at least 20 characters.',
        400,
      );
    const d = parsed.data;
    if (/(?:AKIA|ASIA)[A-Z0-9]{16}|-----BEGIN .*PRIVATE KEY/.test(d.message))
      throw new AccessError('Remove credentials and secrets before sending.', 400);
    await transaction(async (client) => {
      const id = randomUUID();
      await client.query(
        'INSERT INTO contact_enquiries(id,name,email,company,message) VALUES($1,$2,$3,$4,$5)',
        [id, d.name, d.email.toLowerCase(), d.company, d.message],
      );
      await client.query(
        'INSERT INTO mail_outbox(id,to_email,subject,text_body) VALUES($1,$2,$3,$4)',
        [
          randomUUID(),
          process.env.CONTACT_EMAIL || 'enquiries@hkgpipi.com',
          'New HKGpipi enquiry',
          `${d.name}\n${d.email}\n${d.company}\n\n${d.message}`,
        ],
      );
      await client.query(
        'INSERT INTO mail_outbox(id,to_email,subject,text_body) VALUES($1,$2,$3,$4)',
        [
          randomUUID(),
          d.email,
          'We received your HKGpipi enquiry',
          'Thank you. Your enquiry has been recorded and HKGpipi will respond. This does not create an engagement or authorise AWS access.',
        ],
      );
    });
    return Response.json(
      { message: 'Your enquiry has been recorded. We will respond by email.' },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
