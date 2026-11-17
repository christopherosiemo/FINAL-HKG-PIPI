import 'dotenv/config';
import { describe, it, expect, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createOTP } from '@better-auth/utils/otp';
import { base32 } from '@better-auth/utils/base32';
import { sql, pool } from '../src/lib/db';
import { drainMailOutbox } from '../src/lib/mail';
import { recordFinancialUpdate } from '../src/lib/payments';
const enabled = process.env.RUN_INTEGRATION_TESTS === 'true';
const base = process.env.BETTER_AUTH_URL || 'http://127.0.0.1:3001';
class Browser {
  cookies = new Map<string, string>();
  async call(path: string, body?: unknown, method = body ? 'POST' : 'GET') {
    const r = await fetch(new URL(path, base), {
      method,
      redirect: 'manual',
      headers: {
        origin: new URL(base).origin,
        'Content-Type': 'application/json',
        cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    for (const cookie of r.headers.getSetCookie()) {
      const pair = cookie.split(';')[0],
        at = pair.indexOf('=');
      this.cookies.set(pair.slice(0, at), pair.slice(at + 1));
    }
    let data: Record<string, unknown> = {};
    try {
      data = await r.json();
    } catch {}
    return { status: r.status, data, headers: r.headers };
  }
}
describe.skipIf(!enabled)('real local checkout, authentication and payment records', () => {
  afterAll(async () => {
    await pool.end();
  });
  it('pays once, verifies email, isolates organisations, enforces MFA, delivers email and recovers an account', async () => {
    const suffix = randomUUID().slice(0, 8),
      email = `integration-${suffix}@example.test`,
      password = `Integration-${randomUUID()}-Aa1!`,
      buyer = new Browser();
    const config = await buyer.call('/api/v1/orders/config');
    expect(config.status).toBe(200);
    expect(config.data.test).toBe(true);
    expect(config.data.ready).toBe(true);
    const checkoutInput = {
      requestId: randomUUID(),
      name: 'Integration Buyer',
      email,
      company: `Integration fixture ${suffix}`,
      amount: 1,
      currency: 'usd',
      billingAddress: {
        line1: '1 Test Road',
        city: 'London',
        postalCode: 'SE1 1AA',
        country: 'GB',
      },
      acceptTerms: true,
      termsVersion: config.data.termsVersion,
    };
    const created = await buyer.call('/api/v1/orders', checkoutInput);
    expect(created.status).toBe(201);
    const replay = await buyer.call('/api/v1/orders', checkoutInput);
    expect(replay.data.orderId).toBe(created.data.orderId);
    expect(replay.data.checkoutUrl).toBe(created.data.checkoutUrl);
    expect(
      (await buyer.call('/api/v1/orders', { ...checkoutInput, company: 'Altered request' })).status,
    ).toBe(409);
    const id = String(created.data.orderId),
      checkout = new URL(String(created.data.checkoutUrl)),
      access = checkout.searchParams.get('access');
    const payment = await buyer.call('/api/payments/test', { id, access, outcome: 'pay' });
    expect(payment.status).toBe(200);
    expect((await buyer.call('/api/payments/test', { id, access, outcome: 'pay' })).status).toBe(
      200,
    );
    const [counts] = await sql<{ count: string }>(
      "SELECT count(*) FROM engagements WHERE data->>'orderId'=$1",
      [id],
    );
    expect(counts.count).toBe('1');
    expect((await buyer.call(`/api/v1/orders/${id}`)).status).toBe(404);
    const visibleOrder = await buyer.call(`/api/v1/orders/${id}?access=${access}`);
    expect(visibleOrder.data.status).toBe('paid');
    expect(visibleOrder.data.amount).toBe(500000);
    expect(visibleOrder.data.currency).toBe('gbp');
    const signUp = await buyer.call('/api/auth/sign-up/email', {
      name: 'Integration Buyer',
      email,
      password,
      role: 'admin',
      callbackURL: '/activate',
    });
    expect(signUp.status).toBe(200);
    const [user] = await sql<{ id: string; role: string }>(
      'SELECT id,role FROM "user" WHERE email=$1',
      [email],
    );
    expect(user.id).toBeTruthy();
    expect(user.role).toBe('customer');
    expect((await buyer.call('/api/auth/sign-in/email', { email, password })).status).toBe(403);
    const [verification] = await sql<{ text_body: string }>(
      "SELECT text_body FROM mail_outbox WHERE to_email=$1 AND subject='Verify your HKGpipi email' ORDER BY created_at DESC LIMIT 1",
      [email],
    );
    const link = verification.text_body.match(/https?:\/\/\S+/)?.[0];
    expect(link).toBeTruthy();
    const verified = await buyer.call(String(link));
    expect([302, 303]).toContain(verified.status);
    expect((await buyer.call('/api/auth/sign-in/email', { email, password })).status).toBe(200);
    const beforeMfa = new Browser();
    beforeMfa.cookies = new Map(buyer.cookies);
    expect((await buyer.call('/api/activation/claim', {})).data.claimed).toBe(1);
    expect((await buyer.call('/api/activation/claim', {})).data.claimed).toBe(0);
    const [membership] = await sql<{ organizationId: string }>(
      'SELECT "organizationId" FROM "member" WHERE "userId"=$1',
      [user.id],
    );
    expect(membership.organizationId).toBeTruthy();
    const proposalId = randomUUID();
    await sql(
      "INSERT INTO records(id,organisation_id,kind,title,status,data,created_by) VALUES($1,$2,'proposal','Integration implementation scope','draft',$3,$4)",
      [
        proposalId,
        membership.organizationId,
        JSON.stringify({
          offer: 'implementation',
          amount: 1500000,
          currency: 'GBP',
          scope: 'Approved fixture engineering scope',
          termsVersion: config.data.termsVersion,
        }),
        user.id,
      ],
    );
    const implementationInput = {
      name: 'Integration Buyer',
      email,
      company: `Integration fixture ${suffix}`,
      billingAddress: {
        line1: '1 Test Road',
        city: 'London',
        postalCode: 'SE1 1AA',
        country: 'GB',
      },
      acceptTerms: true,
      termsVersion: config.data.termsVersion,
      proposalId,
      amount: 1,
    };
    expect((await buyer.call('/api/v1/orders', implementationInput)).status).toBe(409);
    await sql("UPDATE records SET status='proposed' WHERE id=$1", [proposalId]);
    const accepted = await buyer.call('/api/v1/workspace', {
      action: 'accept',
      organisationId: membership.organizationId,
      entity: 'proposal',
      id: proposalId,
      version: 1,
      data: { reason: 'Fixture owner accepts defined scope and terms' },
    });
    expect(accepted.status).toBe(200);
    const implementation = await buyer.call('/api/v1/orders', implementationInput);
    expect(implementation.status).toBe(201);
    const implementationId = String(implementation.data.orderId);
    const implementationAccess = new URL(String(implementation.data.checkoutUrl)).searchParams.get(
      'access',
    );
    expect(
      (
        await buyer.call('/api/payments/test', {
          id: implementationId,
          access: implementationAccess,
          outcome: 'pay',
        })
      ).status,
    ).toBe(200);
    const implementationOrder = await buyer.call(`/api/v1/orders/${implementationId}`);
    expect(implementationOrder.data.amount).toBe(1500000);
    const [implementationOrg] = await sql<{ organisation_id: string }>(
      'SELECT organisation_id FROM orders WHERE id=$1',
      [implementationId],
    );
    expect(implementationOrg.organisation_id).toBe(membership.organizationId);
    const foreignOrg = randomUUID();
    await sql('INSERT INTO "organization"(id,name,slug) VALUES($1,\'Foreign fixture\',$2)', [
      foreignOrg,
      `foreign-${foreignOrg}`,
    ]);
    expect((await buyer.call(`/api/v1/workspace?organisationId=${foreignOrg}`)).status).toBe(404);
    await sql('UPDATE "user" SET role=\'admin\' WHERE id=$1', [user.id]);
    expect((await buyer.call('/api/payments/reconcile')).status).toBe(403);
    const enrollment = await buyer.call('/api/auth/two-factor/enable', { password });
    expect(enrollment.status).toBe(200);
    const uri = new URL(String(enrollment.data.totpURI));
    const secret = base32.decode(uri.searchParams.get('secret')!);
    const otp = await createOTP(secret).totp();
    const activation = await buyer.call('/api/auth/two-factor/verify-totp', { code: otp });
    expect(activation.status).toBe(200);
    expect((await buyer.call('/api/payments/reconcile')).status).toBe(200);
    expect([401, 403]).toContain((await beforeMfa.call('/api/payments/reconcile')).status);
    const second = new Browser();
    const challenge = await second.call('/api/auth/sign-in/email', { email, password });
    expect(challenge.data.twoFactorRedirect).toBe(true);
    expect((await second.call('/api/payments/reconcile')).status).toBe(401);
    const backup = (enrollment.data.backupCodes as string[])[0];
    expect(
      (await second.call('/api/auth/two-factor/verify-backup-code', { code: backup })).status,
    ).toBe(200);
    expect((await second.call('/api/payments/reconcile')).status).toBe(200);
    expect(
      (await buyer.call('/api/auth/update-user', { name: 'Updated Integration Buyer' })).status,
    ).toBe(200);
    expect(
      (await sql<{ name: string }>('SELECT name FROM "user" WHERE id=$1', [user.id]))[0].name,
    ).toBe('Updated Integration Buyer');
    expect((await buyer.call('/api/auth/revoke-other-sessions', {})).status).toBe(200);
    expect((await second.call('/api/payments/reconcile')).status).toBe(401);
    await recordFinancialUpdate(`fixture-partial-${id}`, 'fixture.refund', `local-${id}`, {
      status: 'partial_refunded',
      refundedAmount: 100,
    });
    expect((await buyer.call(`/api/v1/orders/${id}`)).data.status).toBe('partial_refunded');
    await recordFinancialUpdate(`fixture-dispute-${id}`, 'fixture.dispute', `local-${id}`, {
      status: 'disputed',
      refundedAmount: 100,
      disputeStatus: 'needs_response',
    });
    expect((await buyer.call(`/api/v1/orders/${id}`)).data.status).toBe('disputed');
    expect(
      await recordFinancialUpdate(`fixture-dispute-${id}`, 'fixture.dispute', `local-${id}`, {
        status: 'paid',
        refundedAmount: 0,
      }),
    ).toBe(false);
    await recordFinancialUpdate(`fixture-refund-${id}`, 'fixture.refund.completed', `local-${id}`, {
      status: 'refunded',
      refundedAmount: 500000,
    });
    expect((await buyer.call(`/api/v1/orders/${id}`)).data.status).toBe('refunded');
    await sql('UPDATE "user" SET role=\'customer\' WHERE id=$1', [user.id]);
    await sql('DELETE FROM "member" WHERE "userId"=$1 AND "organizationId"=$2', [
      user.id,
      membership.organizationId,
    ]);
    expect((await buyer.call('/api/activation/claim', {})).data.claimed).toBe(0);
    const [revoked] = await sql<{ count: string }>(
      'SELECT count(*) FROM "member" WHERE "userId"=$1 AND "organizationId"=$2',
      [user.id, membership.organizationId],
    );
    expect(revoked.count).toBe('0');
    const changedPassword = `Changed-${randomUUID()}-Aa1!`;
    expect(
      (
        await buyer.call('/api/auth/change-password', {
          currentPassword: 'incorrect-fixture-password',
          newPassword: changedPassword,
          revokeOtherSessions: true,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await buyer.call('/api/auth/change-password', {
          currentPassword: password,
          newPassword: changedPassword,
          revokeOtherSessions: true,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await buyer.call('/api/auth/request-password-reset', {
          email,
          redirectTo: '/reset-password',
        })
      ).status,
    ).toBe(200);
    const [reset] = await sql<{ text_body: string }>(
      "SELECT text_body FROM mail_outbox WHERE to_email=$1 AND subject='Reset your HKGpipi password' ORDER BY created_at DESC LIMIT 1",
      [email],
    );
    const resetUrl = new URL(reset.text_body.match(/https?:\/\/\S+/)![0]);
    // BetterAuth sends its one-time intermediate URL, which redirects to the UI.
    const resetRedirect = await buyer.call(resetUrl.href);
    const destination = new URL(resetRedirect.headers.get('location') || resetUrl.href, base);
    const token = destination.searchParams.get('token');
    expect(token).toBeTruthy();
    expect(
      (
        await buyer.call('/api/auth/reset-password', {
          token,
          newPassword: `Recovery-${randomUUID()}-Aa1!`,
        })
      ).status,
    ).toBe(200);
    expect((await second.call('/api/payments/reconcile')).status).toBe(401);
    await drainMailOutbox();
    const [sent] = await sql<{ count: string }>(
      "SELECT count(*) FROM mail_outbox WHERE to_email=$1 AND status='sent'",
      [email],
    );
    expect(Number(sent.count)).toBeGreaterThan(0);
    const mailbox = await fetch('http://127.0.0.1:8025/api/v1/messages');
    expect(mailbox.status).toBe(200);
    const messages = (await mailbox.json()) as { messages: { To: { Address: string }[] }[] };
    expect(messages.messages.some((m) => m.To.some((to) => to.Address === email))).toBe(true);
  }, 120000);
});
