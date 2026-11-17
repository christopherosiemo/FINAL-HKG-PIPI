import { randomUUID, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import Stripe from 'stripe';
import { outcomeSettlement } from './outcome-billing';
import { z } from 'zod';
import { sql, transaction } from './db';
import { commercialConfig, appUrl } from './config';
import { AccessError, requireAccess, getAccess } from './access';
export const checkoutSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  company: z.string().trim().min(2).max(160),
  billingAddress: z.object({
    line1: z.string().trim().min(3).max(200),
    line2: z.string().trim().max(200).optional(),
    city: z.string().trim().min(2).max(100),
    postalCode: z.string().trim().min(2).max(20),
    country: z.string().regex(/^[A-Z]{2}$/),
  }),
  acceptTerms: z.literal(true),
  termsVersion: z.string().min(1).max(100),
  proposalId: z.string().max(100).optional(),
  requestId: z.uuid().optional(),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type OrderRow = {
  id: string;
  organisation_id: string | null;
  email: string;
  company: string;
  name: string;
  amount: string;
  currency: string;
  status: string;
  offer: string;
  proposal_id: string | null;
  checkout_key: string;
  stripe_session_id: string | null;
  provider: string;
  receipt_url: string | null;
  created_at: Date;
  billing: Record<string, unknown>;
};
export function secureEqual(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export async function canReadOrder(request: Request, order: OrderRow, key = '') {
  if (secureEqual(key, order.checkout_key)) return true;
  const access = await getAccess(request);
  if (!access?.user.emailVerified) return false;
  if (access.isStaff) return access.user.twoFactorEnabled && access.mfaSessionVerified;
  if (access.user.email.toLowerCase() === order.email.toLowerCase()) return true;
  if (!order.organisation_id) return false;
  const [member] = await sql<{ role: string }>(
    'SELECT role FROM "member" WHERE "organizationId"=$1 AND "userId"=$2',
    [order.organisation_id, access.user.id],
  );
  return !!member && ['owner', 'billing'].includes(member.role);
}
export function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new AccessError('Secure payment configuration is incomplete.', 503);
  return new Stripe(key);
}
export function assertCheckoutReady() {
  const config = commercialConfig();
  if (!config.ready)
    throw new AccessError(
      'Online ordering is awaiting approved commercial terms, tax treatment and payment configuration. Contact enquiries@hkgpipi.com.',
      503,
    );
  if (config.provider === 'stripe' && config.taxMode !== 'exempt' && !config.automaticTax)
    throw new AccessError('Automatic tax must be configured before checkout.', 503);
  return config;
}
async function priorCheckout(requestId: string, fingerprint: string) {
  const [prior] = await sql<{
    id: string;
    status: string;
    checkout_key: string;
    checkout_url: string | null;
    request_fingerprint: string;
  }>(
    'SELECT id,status,checkout_key,checkout_url,request_fingerprint FROM orders WHERE request_key=$1',
    [requestId],
  );
  if (!prior) return null;
  if (prior.request_fingerprint !== fingerprint)
    throw new AccessError(
      'The details for this checkout have changed. Refresh to start a new order.',
      409,
    );
  if (['paid', 'partial_refunded', 'refunded', 'disputed'].includes(prior.status))
    return {
      orderId: prior.id,
      checkoutUrl: `${appUrl()}/order/${prior.id}?access=${prior.checkout_key}`,
    };
  if (prior.status === 'pending' && prior.checkout_url)
    return { orderId: prior.id, checkoutUrl: prior.checkout_url };
  throw new AccessError(
    prior.status === 'pending'
      ? 'Your checkout is still being prepared. Please retry shortly.'
      : 'This checkout has ended. Refresh to start a new order.',
    409,
  );
}
export async function getProposalPricing(id: string, request?: Request) {
  const [p] = await sql<{
    organisation_id: string;
    status: string;
    version: number;
    data: Record<string, unknown>;
  }>("SELECT organisation_id,status,version,data FROM records WHERE id=$1 AND kind='proposal'", [
    id,
  ]);
  if (!p) throw new AccessError('Proposal not found.', 404);
  const access = await requireAccess(request, { organisationId: p.organisation_id });
  if (access.isStaff || !['owner', 'billing'].includes(access.organisationRole || ''))
    throw new AccessError('The customer owner or billing contact must authorise payment.', 403);
  const [existing] = await sql<{ id: string; status: string; checkout_url: string | null }>(
    "SELECT id,status,checkout_url FROM orders WHERE proposal_id=$1 AND status IN ('pending','paid','partial_refunded','disputed','refunded') ORDER BY created_at DESC LIMIT 1",
    [id],
  );
  const priorOrder = {
    existingOrderId: existing?.id,
    existingOrderStatus: existing?.status,
    existingCheckoutUrl: existing?.status === 'pending' ? existing.checkout_url : undefined,
  };
  const config = commercialConfig();
  if (
    p.status !== 'accepted' ||
    !p.data.scope ||
    p.data.termsVersion !== config.termsVersion ||
    !p.data.acceptedBy ||
    !p.data.acceptedAt ||
    String(p.data.currency).toLowerCase() !== 'gbp'
  )
    throw new AccessError('Scope and commercial terms must be accepted before payment.', 409);
  if (p.data.offer === 'implementation' && Number(p.data.amount) === 1500000)
    return {
      organisationId: p.organisation_id,
      amount: 1500000,
      offer: 'implementation',
      title: 'Implementation Sprint',
      ...priorOrder,
      email: access.user.email,
      proposalSnapshot: { ...p.data, id, version: p.version },
    };
  if (p.data.offer === 'outcome' && p.data.parentProposalId) {
    const settlement = await outcomeSettlement(p.data, p.organisation_id, id);
    if (settlement.amount !== Number(p.data.settlementAmount))
      throw new AccessError('The outcome payment request must be reissued and accepted.', 409);
    return {
      organisationId: p.organisation_id,
      amount: settlement.amount,
      offer: 'outcome',
      title: 'Approved outcome-based implementation payment',
      ...priorOrder,
      email: access.user.email,
      proposalSnapshot: { ...p.data, id, version: p.version },
    };
  }
  throw new AccessError(
    'An outcome payment requires a separately accepted settlement tied to published verification.',
    409,
  );
}

export async function createOrder(raw: unknown, request: Request) {
  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success)
    throw new AccessError(
      'Review your company details, billing address and terms acceptance.',
      400,
    );
  const input = parsed.data,
    config = assertCheckoutReady();
  if (input.termsVersion !== config.termsVersion)
    throw new AccessError('The checkout terms have changed. Refresh and review them again.', 409);
  const fingerprint = createHash('sha256')
    .update(JSON.stringify({ ...input, requestId: undefined }))
    .digest('hex');
  let organisationId: string | null = null,
    amount = 500000,
    offer = 'savings-sprint';
  let proposalSnapshot: Record<string, unknown> | undefined;
  if (input.proposalId) {
    const price = await getProposalPricing(input.proposalId, request);
    if (price.email.toLowerCase() !== input.email)
      throw new AccessError('Use your verified account email for this order.', 400);
    organisationId = price.organisationId;
    amount = price.amount;
    offer = price.offer;
    proposalSnapshot = price.proposalSnapshot;
  }
  if (input.requestId) {
    const prior = await priorCheckout(input.requestId, fingerprint);
    if (prior) return prior;
  }
  const id = randomUUID(),
    key = randomBytes(32).toString('hex');
  const legal = {
    version: config.termsVersion,
    url: config.termsUrl,
    sellerName: config.sellerName,
    sellerAddress: config.sellerAddress,
    acceptedAt: new Date().toISOString(),
    proposalSnapshot,
  };
  try {
    await sql(
      "INSERT INTO orders(id,organisation_id,email,company,name,amount,currency,offer,proposal_id,checkout_key,terms_version,legal_snapshot,tax_snapshot,billing,provider,request_key,request_fingerprint) VALUES($1,$2,$3,$4,$5,$6,'gbp',$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)",
      [
        id,
        organisationId,
        input.email,
        input.company,
        input.name,
        amount,
        offer,
        input.proposalId || null,
        key,
        config.termsVersion,
        JSON.stringify(legal),
        JSON.stringify({ mode: config.taxMode, label: config.taxLabel }),
        JSON.stringify({
          address: input.billingAddress,
          test: config.test || config.stripeTestMode,
        }),
        config.provider,
        input.requestId || null,
        fingerprint,
      ],
    );
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      if (input.requestId) {
        const prior = await priorCheckout(input.requestId, fingerprint);
        if (prior) return prior;
      }
      throw new AccessError('This implementation proposal already has an active order.', 409);
    }
    throw error;
  }
  if (config.test) {
    const checkoutUrl = `${appUrl()}/payments/test/${id}?access=${key}`;
    await sql('UPDATE orders SET checkout_url=$2 WHERE id=$1', [id, checkoutUrl]);
    return { orderId: id, checkoutUrl };
  }
  try {
    const stripe = stripeClient();
    const customer = await stripe.customers.create(
      {
        email: input.email,
        name: input.company,
        address: {
          line1: input.billingAddress.line1,
          line2: input.billingAddress.line2,
          city: input.billingAddress.city,
          postal_code: input.billingAddress.postalCode,
          country: input.billingAddress.country,
        },
        metadata: { order_id: id },
      },
      { idempotencyKey: `customer-${id}` },
    );
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        customer: customer.id,
        customer_update: { address: 'auto', name: 'auto' },
        billing_address_collection: 'required',
        automatic_tax: { enabled: config.automaticTax },
        tax_id_collection: { enabled: true },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'gbp',
              unit_amount: amount,
              tax_behavior: config.taxMode === 'exclusive' ? 'exclusive' : 'inclusive',
              product_data: {
                name:
                  offer === 'savings-sprint'
                    ? '14-Day AWS Savings Sprint'
                    : offer === 'outcome'
                      ? 'Approved outcome-based implementation payment'
                      : 'Implementation Sprint',
                description:
                  offer === 'savings-sprint'
                    ? 'Read-only discovery, ranked Savings Ledger and implementation roadmap.'
                    : offer === 'outcome'
                      ? 'Customer-approved payment under the agreed verified-savings basis.'
                      : 'Approved implementation scope through customer engineering controls.',
              },
            },
          },
        ],
        metadata: { order_id: id },
        payment_intent_data: { metadata: { order_id: id } },
        success_url: `${appUrl()}/order/${id}?access=${key}`,
        cancel_url: `${appUrl()}/order/${id}?access=${key}&cancelled=1`,
      },
      { idempotencyKey: `checkout-${id}` },
    );
    await sql(
      'UPDATE orders SET stripe_session_id=$2,checkout_url=$3,updated_at=now() WHERE id=$1',
      [id, session.id, session.url],
    );
    if (!session.url) throw new Error('Stripe did not return checkout URL');
    return { orderId: id, checkoutUrl: session.url };
  } catch (error) {
    await sql(
      "UPDATE orders SET status='failed',updated_at=now() WHERE id=$1 AND status='pending'",
      [id],
    );
    throw error;
  }
}
export async function fulfilPayment(
  eventId: string,
  eventType: string,
  orderId: string,
  paymentId: string,
  details: {
    subtotal: number;
    currency: string;
    total?: number;
    receiptUrl?: string | null;
    provider: 'stripe' | 'test';
    testMode?: boolean;
  },
) {
  return transaction(async (client) => {
    const inserted = await client.query(
      'INSERT INTO payment_events(id,type,order_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id',
      [eventId, eventType, orderId],
    );
    if (!inserted.rowCount) return { duplicate: true };
    const { rows } = await client.query<OrderRow>('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [
      orderId,
    ]);
    const order = rows[0];
    if (!order) throw new Error('Unknown payment order');
    if (
      order.provider !== details.provider ||
      Number(order.amount) !== details.subtotal ||
      order.currency !== details.currency
    )
      throw new Error('Payment amount, currency or provider mismatch');
    if (['paid', 'partial_refunded', 'disputed', 'refunded'].includes(order.status)) {
      await client.query('UPDATE payment_events SET processed_at=now() WHERE id=$1', [eventId]);
      return { duplicate: true };
    }
    let org = order.organisation_id;
    if (!org) {
      org = randomUUID();
      await client.query('INSERT INTO "organization"(id,name,slug) VALUES($1,$2,$3)', [
        org,
        order.company,
        `customer-${org}`,
      ]);
    }
    const isTest = details.provider === 'test' || !!details.testMode;
    await client.query(
      "UPDATE orders SET status='paid',organisation_id=$2,stripe_payment_id=$3,receipt_url=$4,billing=billing || $5::jsonb,updated_at=now() WHERE id=$1",
      [
        order.id,
        org,
        paymentId,
        details.receiptUrl || null,
        JSON.stringify({
          total: details.total || details.subtotal,
          paidAt: new Date().toISOString(),
          test: isTest,
        }),
      ],
    );
    if (order.offer !== 'savings-sprint')
      await client.query(
        'UPDATE orders SET claimed_at=now(),claimed_by=(SELECT id FROM "user" WHERE lower(email)=lower($2)) WHERE id=$1',
        [order.id, order.email],
      );
    if (order.offer !== 'outcome')
      await client.query(
        "INSERT INTO engagements(id,organisation_id,title,status,stage,data) VALUES($1,$2,$3,'onboarding','Find',$4)",
        [
          randomUUID(),
          org,
          order.offer === 'savings-sprint' ? '14-Day AWS Savings Sprint' : 'Implementation Sprint',
          JSON.stringify({ orderId: order.id, offer: order.offer, test: isTest }),
        ],
      );
    await client.query(
      "INSERT INTO audit_events(id,organisation_id,actor_id,action,entity_id,detail) VALUES($1,$2,'payment-provider','order.paid',$3,$4)",
      [
        randomUUID(),
        org,
        order.id,
        JSON.stringify({ eventId, provider: details.provider, paymentId }),
      ],
    );
    await client.query(
      'INSERT INTO mail_outbox(id,to_email,subject,text_body) VALUES($1,$2,$3,$4)',
      [
        randomUUID(),
        order.email,
        `${isTest ? '[TEST] ' : ''}HKGpipi order confirmation`,
        `Your ${isTest ? 'test ' : ''}order ${order.id} has been confirmed. ${isTest ? 'No real money was charged.' : 'Payment was confirmed by Stripe.'}\nCreate or sign in to an account using this email, verify your email, and claim your engagement at ${appUrl()}/activate.\n${details.receiptUrl ? `Payment receipt: ${details.receiptUrl}` : ''}`,
      ],
    );
    await client.query('UPDATE payment_events SET processed_at=now() WHERE id=$1', [eventId]);
    return { duplicate: false };
  });
}
export async function claimPaidOrders(userId: string, email: string) {
  return transaction(async (client) => {
    const { rows } = await client.query<{ id: string; organisation_id: string; offer: string }>(
      "SELECT id,organisation_id,offer FROM orders WHERE lower(email)=lower($1) AND status IN ('paid','partial_refunded') AND organisation_id IS NOT NULL AND claimed_at IS NULL FOR UPDATE",
      [email],
    );
    let count = 0;
    for (const order of rows) {
      if (order.offer === 'savings-sprint') {
        const result = await client.query(
          'INSERT INTO "member"(id,"organizationId","userId",role) VALUES($1,$2,$3,\'owner\') ON CONFLICT("organizationId","userId") DO NOTHING RETURNING id',
          [randomUUID(), order.organisation_id, userId],
        );
        if (result.rowCount) count++;
      }
      await client.query('UPDATE orders SET claimed_at=now(),claimed_by=$2 WHERE id=$1', [
        order.id,
        userId,
      ]);
      await client.query(
        "INSERT INTO audit_events(id,organisation_id,actor_id,action,entity_id) VALUES($1,$2,$3,'order.claimed',$4)",
        [randomUUID(), order.organisation_id, userId, order.id],
      );
    }
    return count;
  });
}
export type PaymentFinancialUpdate = {
  status: 'paid' | 'refunded' | 'partial_refunded' | 'disputed';
  refundedAmount: number;
  disputeId?: string;
  disputeStatus?: string;
  receiptUrl?: string | null;
};
export async function recordFinancialUpdate(
  eventId: string,
  eventType: string,
  paymentId: string,
  update: PaymentFinancialUpdate | (() => Promise<PaymentFinancialUpdate>),
) {
  return transaction(async (client) => {
    const { rows } = await client.query<{ id: string; organisation_id: string | null }>(
      'SELECT id,organisation_id FROM orders WHERE stripe_payment_id=$1 FOR UPDATE',
      [paymentId],
    );
    const order = rows[0];
    if (!order) throw new Error('Payment order has not been fulfilled yet. Retry required.');
    const inserted = await client.query(
      'INSERT INTO payment_events(id,type,order_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id',
      [eventId, eventType, order.id],
    );
    if (!inserted.rowCount) return false;
    // Read the authoritative provider state only after acquiring the order lock.
    // Webhooks and reconciliation can otherwise fetch in one order and commit
    // in the opposite order, overwriting a newer refund/dispute snapshot.
    const current = typeof update === 'function' ? await update() : update;
    await client.query(
      'UPDATE orders SET status=$2,billing=billing || $3::jsonb,receipt_url=COALESCE($4,receipt_url),updated_at=now() WHERE id=$1',
      [order.id, current.status, JSON.stringify(current), current.receiptUrl || null],
    );
    await client.query('UPDATE payment_events SET detail=$2,processed_at=now() WHERE id=$1', [
      eventId,
      JSON.stringify(current),
    ]);
    await client.query(
      "INSERT INTO audit_events(id,organisation_id,actor_id,action,entity_id,detail) VALUES($1,$2,'payment-provider',$3,$4,$5)",
      [
        randomUUID(),
        order.organisation_id,
        `payment.${current.status}`,
        order.id,
        JSON.stringify({ eventId, ...current }),
      ],
    );
    return true;
  });
}
export async function financialState(
  paymentId: string,
  stripe: Stripe = stripeClient(),
): Promise<PaymentFinancialUpdate> {
  const pi = await stripe.paymentIntents.retrieve(paymentId, { expand: ['latest_charge'] });
  const charge = pi.latest_charge && typeof pi.latest_charge !== 'string' ? pi.latest_charge : null;
  if (!charge) throw new Error('Payment charge not available.');
  const disputes = await stripe.disputes.list({ payment_intent: paymentId, limit: 10 });
  const active = disputes.data.find(
    (d) => !['won', 'warning_closed', 'prevented'].includes(d.status),
  );
  return {
    status: active
      ? 'disputed'
      : charge.refunded
        ? 'refunded'
        : charge.amount_refunded > 0
          ? 'partial_refunded'
          : 'paid',
    refundedAmount: charge.amount_refunded,
    disputeId: disputes.data[0]?.id,
    disputeStatus: disputes.data[0]?.status,
    receiptUrl: charge.receipt_url,
  };
}
export async function validatedStripeAmount(session: Stripe.Checkout.Session, order: OrderRow) {
  const lines = await stripeClient().checkout.sessions.listLineItems(session.id, { limit: 2 });
  const line = lines.data[0];
  // Verify the immutable server-created unit price. amount_subtotal may exclude
  // inclusive tax, so it is not a safe substitute for validating the sold price.
  if (
    lines.has_more ||
    lines.data.length !== 1 ||
    line.quantity !== 1 ||
    line.price?.unit_amount !== Number(order.amount) ||
    line.currency !== order.currency ||
    session.currency !== order.currency ||
    line.amount_discount !== 0 ||
    !session.amount_total
  )
    throw new Error('Checkout price evidence does not match the order');
  return {
    subtotal: Number(order.amount),
    currency: order.currency,
    total: session.amount_total,
    testMode: !session.livemode,
  };
}
export async function reconcilePayments(orderId?: string, actorId = 'worker') {
  if (commercialConfig().provider !== 'stripe')
    return { checked: 0, failed: 0, mode: 'local-test' };
  const orders = await sql<OrderRow>(
    "SELECT * FROM orders WHERE provider='stripe' AND stripe_session_id IS NOT NULL AND ($1::text IS NULL OR id=$1) AND status IN ('pending','paid','partial_refunded','disputed','failed') AND ($1::text IS NOT NULL OR last_reconciled_at IS NULL OR last_reconciled_at < now()-interval '1 hour') ORDER BY last_reconciled_at NULLS FIRST LIMIT 50",
    [orderId || null],
  );
  let failed = 0;
  for (const order of orders) {
    try {
      const session = await stripeClient().checkout.sessions.retrieve(order.stripe_session_id!);
      const paymentId =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id;
      if (session.payment_status === 'paid' && paymentId) {
        await fulfilPayment(
          `reconcile-paid-${session.id}`,
          'reconciliation.payment.confirmed',
          order.id,
          paymentId,
          { ...(await validatedStripeAmount(session, order)), provider: 'stripe' },
        );
        await recordFinancialUpdate(
          `reconcile-state-${randomUUID()}`,
          'reconciliation.financial_state',
          paymentId,
          () => financialState(paymentId),
        );
      } else if (session.status === 'expired')
        await sql(
          "UPDATE orders SET status='expired' WHERE id=$1 AND status IN ('pending','failed')",
          [order.id],
        );
      await sql(
        'UPDATE orders SET last_reconciled_at=now(),reconciliation_error=NULL WHERE id=$1',
        [order.id],
      );
      await sql(
        "INSERT INTO payment_reconciliations(id,order_id,actor_id,status,detail) VALUES($1,$2,$3,'completed',$4)",
        [
          randomUUID(),
          order.id,
          actorId,
          JSON.stringify({ sessionStatus: session.status, paymentStatus: session.payment_status }),
        ],
      );
    } catch {
      failed++;
      await sql(
        "UPDATE orders SET last_reconciled_at=now(),reconciliation_error='Provider reconciliation failed; retry or inspect Stripe logs' WHERE id=$1",
        [order.id],
      );
      await sql(
        "INSERT INTO payment_reconciliations(id,order_id,actor_id,status) VALUES($1,$2,$3,'failed')",
        [randomUUID(), order.id, actorId],
      );
    }
  }
  return { checked: orders.length, failed, mode: 'stripe' };
}
