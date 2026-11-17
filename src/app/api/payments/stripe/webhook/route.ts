import Stripe from 'stripe';
import {
  stripeClient,
  fulfilPayment,
  OrderRow,
  financialState,
  recordFinancialUpdate,
  validatedStripeAmount,
} from '@/lib/payments';
import { sql, transaction } from '@/lib/db';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret)
    return Response.json({ error: 'Webhook verification unavailable.' }, { status: 400 });
  let event: Stripe.Event;
  try {
    event = stripeClient().webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return Response.json({ error: 'Invalid webhook signature.' }, { status: 400 });
  }
  try {
    if (
      ['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(
        event.type,
      )
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status !== 'paid') return Response.json({ received: true });
      const orderId = session.metadata?.order_id;
      if (!orderId) return Response.json({ received: true, ignored: true });
      const [order] = await sql<OrderRow>('SELECT * FROM orders WHERE id=$1', [orderId]);
      if (!order || order.stripe_session_id !== session.id)
        throw new Error('Checkout session does not match order');
      const paymentId =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id;
      if (!paymentId) throw new Error('Payment intent missing');
      let receiptUrl: string | null = null;
      const pi = await stripeClient().paymentIntents.retrieve(paymentId, {
        expand: ['latest_charge'],
      });
      if (pi.latest_charge && typeof pi.latest_charge !== 'string')
        receiptUrl = pi.latest_charge.receipt_url;
      if (pi.status !== 'succeeded' || pi.amount_received !== session.amount_total)
        throw new Error('Payment amount has not been fully received');
      await fulfilPayment(event.id, event.type, orderId, paymentId, {
        ...(await validatedStripeAmount(session, order)),
        receiptUrl,
        provider: 'stripe',
      });
    } else if (
      ['checkout.session.expired', 'checkout.session.async_payment_failed'].includes(event.type)
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      await transaction(async (client) => {
        const inserted = await client.query(
          'INSERT INTO payment_events(id,type,order_id,processed_at) VALUES($1,$2,$3,now()) ON CONFLICT DO NOTHING RETURNING id',
          [event.id, event.type, session.metadata?.order_id || null],
        );
        if (inserted.rowCount)
          await client.query(
            "UPDATE orders SET status=$2,updated_at=now() WHERE stripe_session_id=$1 AND status='pending'",
            [session.id, event.type.endsWith('expired') ? 'expired' : 'failed'],
          );
      });
    } else if (
      event.type === 'charge.refunded' ||
      event.type.startsWith('charge.dispute.') ||
      event.type.startsWith('refund.')
    ) {
      const object = event.data.object as Stripe.Charge | Stripe.Dispute | Stripe.Refund;
      const pi =
        typeof object.payment_intent === 'string'
          ? object.payment_intent
          : object.payment_intent?.id;
      if (!pi) return Response.json({ received: true, ignored: true });
      const known = await sql('SELECT id FROM orders WHERE stripe_payment_id=$1', [pi]);
      if (!known.length) {
        const intent = await stripeClient().paymentIntents.retrieve(pi);
        if (!intent.metadata.order_id) return Response.json({ received: true, ignored: true });
        throw new Error('Related payment is awaiting fulfillment; retry required.');
      }
      // Read the provider's current financial state so out-of-order refund/dispute
      // events cannot restore stale paid/refunded statuses.
      await recordFinancialUpdate(event.id, event.type, pi, await financialState(pi));
    }
    return Response.json({ received: true });
  } catch (error) {
    console.error(
      'stripe_webhook_processing_failed',
      event.id,
      error instanceof Error ? error.message : 'Unknown error',
    );
    return Response.json(
      { error: 'Payment event processing failed; retry required.' },
      { status: 500 },
    );
  }
}
