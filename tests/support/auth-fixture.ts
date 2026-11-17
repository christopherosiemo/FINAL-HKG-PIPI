import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { createOTP } from '@better-auth/utils/otp';
import { base32 } from '@better-auth/utils/base32';
import { sql } from '../../src/lib/db';
export class FixtureBrowser {
  cookies = new Map<string, string>();
  readonly testIp = `192.0.2.${1 + Math.floor(Math.random() * 253)}`;
  constructor(public base = process.env.BETTER_AUTH_URL || 'http://127.0.0.1:3001') {}
  async call(path: string, body?: unknown, method = body ? 'POST' : 'GET') {
    const response = await fetch(new URL(path, this.base), {
      method,
      redirect: 'manual',
      headers: {
        origin: new URL(this.base).origin,
        'x-forwarded-for': this.testIp,
        'cf-connecting-ip': this.testIp,
        'Content-Type': 'application/json',
        cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0],
        at = pair.indexOf('=');
      this.cookies.set(pair.slice(0, at), pair.slice(at + 1));
    }
    let data: Record<string, unknown> = {};
    try {
      data = await response.json();
    } catch {}
    return { status: response.status, data, headers: response.headers };
  }
  playwrightCookies() {
    return [...this.cookies]
      .filter(([, value]) => !!value)
      .map(([name, value]) => ({
        name,
        value,
        url: this.base,
        httpOnly: true,
        sameSite: 'Lax' as const,
      }));
  }
}
export async function createVerifiedFixtureSession({
  staff = false,
  engagement = true,
}: { staff?: boolean; engagement?: boolean } = {}) {
  const browser = new FixtureBrowser();
  if (
    process.env.NODE_ENV === 'production' ||
    process.env.PAYMENTS_PROVIDER !== 'test' ||
    !['127.0.0.1', 'localhost'].includes(new URL(browser.base).hostname)
  )
    throw new Error(
      'Fixture sessions are restricted to local development with the explicit test adapter.',
    );
  const suffix = randomUUID().slice(0, 8),
    email = `ui-${staff ? 'admin' : 'customer'}-${suffix}@example.test`,
    password = `Fixture-${randomUUID()}-Aa1!`;
  const result = await browser.call('/api/auth/sign-up/email', {
    name: staff ? 'Fixture Administrator' : 'Fixture Customer',
    email,
    password,
  });
  if (result.status !== 200) throw new Error(`Fixture signup failed (${result.status}).`);
  const [user] = await sql<{ id: string }>(
    'UPDATE "user" SET "emailVerified"=true,role=$2 WHERE email=$1 RETURNING id',
    [email, staff ? 'admin' : 'customer'],
  );
  const login = await browser.call('/api/auth/sign-in/email', { email, password });
  if (login.status !== 200) throw new Error(`Fixture login failed (${login.status}).`);
  if (staff) {
    const enroll = await browser.call('/api/auth/two-factor/enable', { password });
    if (enroll.status !== 200) throw new Error(`Fixture MFA enrollment failed (${enroll.status}).`);
    const uri = new URL(String(enroll.data.totpURI));
    const code = await createOTP(base32.decode(uri.searchParams.get('secret')!)).totp();
    const verify = await browser.call('/api/auth/two-factor/verify-totp', { code });
    if (verify.status !== 200)
      throw new Error(`Fixture MFA verification failed (${verify.status}).`);
  }
  let organisationId: string | null = null,
    engagementId: string | null = null;
  if (engagement) {
    organisationId = randomUUID();
    engagementId = randomUUID();
    await sql('INSERT INTO "organization"(id,name,slug) VALUES($1,$2,$3)', [
      organisationId,
      `UI test company ${suffix}`,
      `ui-${suffix}`,
    ]);
    await sql(
      'INSERT INTO "member"(id,"organizationId","userId",role) VALUES($1,$2,$3,\'owner\')',
      [randomUUID(), organisationId, user.id],
    );
    await sql(
      "INSERT INTO engagements(id,organisation_id,title,status,stage,data) VALUES($1,$2,'14-Day AWS Savings Sprint','onboarding','Find',$3)",
      [engagementId, organisationId, JSON.stringify({ fixture: true, test: true })],
    );
  }
  return { browser, userId: user.id, email, password, organisationId, engagementId };
}
