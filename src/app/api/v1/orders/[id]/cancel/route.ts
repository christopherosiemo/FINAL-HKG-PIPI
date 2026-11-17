import { randomUUID } from 'node:crypto';
import { apiError, assertSameOrigin, AccessError, getAccess } from '@/lib/access';
import { sql, transaction } from '@/lib/db';
import { OrderRow, secureEqual, stripeClient, reconcilePayments } from '@/lib/payments';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const body = await request.json();
    const [order] = await sql<OrderRow>('SELECT * FROM orders WHERE id=$1', [id]);
    if (!order) throw new AccessError('Order not found.', 404);
    const access = await getAccess(request);
    const owner =
      access?.user.emailVerified && access.user.email.toLowerCase() === order.email.toLowerCase();
    if (
      !owner &&
      !(typeof body.access === 'string' && secureEqual(body.access, order.checkout_key))
    )
      throw new AccessError('Order not found.', 404);
    if (order.status === 'cancelled') return Response.json({ status: 'cancelled' });
    if (!['pending', 'failed'].includes(order.status))
      throw new AccessError(
        'A confirmed payment cannot be cancelled here. Contact HKGpipi about your engagement.',
        409,
      );
    if (order.provider === 'stripe' && order.stripe_session_id) {
      const session = await stripeClient().checkout.sessions.retrieve(order.stripe_session_id);
      if (session.status === 'complete') {
        await reconcilePayments(order.id, access?.user.id || 'customer');
        throw new AccessError('Payment has completed. Contact HKGpipi about your engagement.', 409);
      }
      if (session.status === 'open') await stripeClient().checkout.sessions.expire(session.id);
    }
    await transaction(async (client) => {
      await client.query(
        "UPDATE orders SET status='cancelled',updated_at=now() WHERE id=$1 AND status IN ('pending','failed')",
        [id],
      );
      await client.query(
        "INSERT INTO payment_events(id,type,order_id,processed_at) VALUES($1,'customer.checkout_cancelled',$2,now())",
        [randomUUID(), id],
      );
    });
    return Response.json({ status: 'cancelled' });
  } catch (error) {
    return apiError(error);
  }
}
