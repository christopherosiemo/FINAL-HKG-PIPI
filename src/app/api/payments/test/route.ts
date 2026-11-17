import { apiError, assertSameOrigin, AccessError, rateLimit } from '@/lib/access';
import { commercialConfig, appUrl } from '@/lib/config';
import { sql } from '@/lib/db';
import { OrderRow, secureEqual, fulfilPayment } from '@/lib/payments';
export async function POST(request: Request) {
  try {
    const config = commercialConfig();
    if (!config.test) throw new AccessError('Test payment route unavailable.', 404);
    assertSameOrigin(request);
    await rateLimit(request, 'test-payment', 10);
    const { id, access, outcome } = await request.json();
    const [order] = await sql<OrderRow>('SELECT * FROM orders WHERE id=$1', [String(id)]);
    if (
      !order ||
      order.provider !== 'test' ||
      typeof access !== 'string' ||
      !secureEqual(access, order.checkout_key)
    )
      throw new AccessError('Order not found.', 404);
    if (outcome === 'fail') {
      await sql(
        "UPDATE orders SET status='failed',updated_at=now() WHERE id=$1 AND status='pending'",
        [order.id],
      );
    } else if (outcome === 'pay') {
      await fulfilPayment(
        `test-${order.id}`,
        'test.payment.completed',
        order.id,
        `local-${order.id}`,
        { subtotal: Number(order.amount), currency: order.currency, provider: 'test' },
      );
    } else throw new AccessError('Select a test outcome.', 400);
    return Response.json({ url: `${appUrl()}/order/${order.id}?access=${order.checkout_key}` });
  } catch (error) {
    return apiError(error);
  }
}
