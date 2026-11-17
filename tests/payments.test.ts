import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  checkoutSchema,
  secureEqual,
  assertCheckoutReady,
  financialState,
} from '../src/lib/payments';
import Stripe from 'stripe';
import { renderMailHtml } from '../src/lib/mail';
const order = {
  name: 'Test Buyer',
  email: 'BUYER@example.com',
  company: 'Example Ltd',
  billingAddress: { line1: '1 Example Road', city: 'London', postalCode: 'SE1 1AA', country: 'GB' },
  acceptTerms: true,
  termsVersion: 'approved-v1',
};
describe('commercial boundaries', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('normalises the ordering email and rejects missing authority or billing details', () => {
    expect(checkoutSchema.parse(order).email).toBe('buyer@example.com');
    expect(checkoutSchema.safeParse({ ...order, acceptTerms: false }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...order, billingAddress: {} }).success).toBe(false);
  });
  it('compares opaque checkout access tokens without accepting prefixes', () => {
    expect(secureEqual('a'.repeat(64), 'a'.repeat(64))).toBe(true);
    expect(secureEqual('a'.repeat(64), 'a'.repeat(63))).toBe(false);
    expect(secureEqual('a'.repeat(64), 'b'.repeat(64))).toBe(false);
  });
  it('prevents unapproved legal and tax details from accepting money', () => {
    vi.stubEnv('PAYMENTS_PROVIDER', 'stripe');
    vi.stubEnv('LEGAL_APPROVED', 'false');
    vi.stubEnv('TAX_APPROVED', 'false');
    expect(() => assertCheckoutReady()).toThrow(/approved commercial/);
  });
  it('requires an approved privacy notice as well as service terms', () => {
    vi.stubEnv('LEGAL_PRIVACY_URL', '');
    expect(() => assertCheckoutReady()).toThrow(/approved commercial/);
  });
  it('forbids the explicit local payment adapter in production', () => {
    vi.stubEnv('PAYMENTS_PROVIDER', 'test');
    vi.stubEnv('ENABLE_TEST_PAYMENTS', 'true');
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => assertCheckoutReady()).toThrow(/disabled/);
  });
  it('uses the provider signature verifier against exact raw webhook bytes', () => {
    const stripe = new Stripe('sk_test_local_signature_fixture');
    const secret = 'whsec_local_fixture';
    const payload = JSON.stringify({
      id: 'evt_fixture',
      type: 'checkout.session.completed',
      object: 'event',
      data: { object: { id: 'cs_fixture' } },
    });
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
    expect(stripe.webhooks.constructEvent(payload, signature, secret).id).toBe('evt_fixture');
    expect(() => stripe.webhooks.constructEvent(payload + ' ', signature, secret)).toThrow();
    expect(() => stripe.webhooks.constructEvent(payload, signature, 'whsec_wrong')).toThrow();
  });
  it('does not let a local fixture legal approval enable a live Stripe account', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('PAYMENTS_PROVIDER', 'stripe');
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_live_OFFLINE_FIXTURE_ONLY');
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_fixture');
    vi.stubEnv('LEGAL_APPROVED', 'true');
    vi.stubEnv('LEGAL_TERMS_VERSION', 'local-fixture-v1');
    vi.stubEnv('LEGAL_TERMS_URL', 'https://example.test/terms');
    vi.stubEnv('SELLER_LEGAL_NAME', 'HKGpipi LOCAL TEST FIXTURE');
    vi.stubEnv('SELLER_ADDRESS', 'Local fixture');
    vi.stubEnv('TAX_APPROVED', 'true');
    vi.stubEnv('TAX_MODE', 'exempt');
    vi.stubEnv('TAX_LABEL', 'Fixture');
    expect(() => assertCheckoutReady()).toThrow(/approved commercial/);
  });
  it('escapes transactional content and never linkifies unsafe URL schemes', () => {
    const html = renderMailHtml(
      '<script>alert(1)</script>',
      '<img onerror=alert(1)> javascript:alert(1)\nhttps://example.test/verify?token=a&next=b',
    );
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img onerror');
    expect(html).toContain('&lt;img onerror');
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain('href="https://example.test/verify?token=a&amp;next=b"');
  });
  it('reconciles delayed refund/dispute events against current provider state using offline SDK-shaped fixtures', async () => {
    let refunded = 100,
      dispute = 'needs_response';
    const fixture = {
      paymentIntents: {
        retrieve: async () => ({
          latest_charge: {
            amount_refunded: refunded,
            refunded: refunded === 500000,
            receipt_url: 'https://pay.stripe.com/receipt/fixture',
          },
        }),
      },
      disputes: { list: async () => ({ data: [{ id: 'dp_fixture', status: dispute }] }) },
    } as unknown as Stripe;
    expect((await financialState('pi_fixture', fixture)).status).toBe('disputed');
    dispute = 'won';
    expect((await financialState('pi_fixture', fixture)).status).toBe('partial_refunded');
    refunded = 500000;
    expect((await financialState('pi_fixture', fixture)).status).toBe('refunded');
    expect((await financialState('pi_fixture', fixture)).status).toBe('refunded');
  });
});
