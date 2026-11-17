import { apiError, AccessError } from '@/lib/access';
import { sql } from '@/lib/db';
import { type OrderRow, canReadOrder } from '@/lib/payments';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const [order] = await sql<OrderRow>('SELECT * FROM orders WHERE id=$1', [id]);
    if (!order) throw new AccessError('Order not found.', 404);
    if (
      !(await canReadOrder(request, order, new URL(request.url).searchParams.get('access') || ''))
    )
      throw new AccessError('Order not found.', 404);
    return Response.json(
      {
        id: order.id,
        amount: Number(order.amount),
        currency: order.currency,
        status: order.status,
        offer: order.offer,
        createdAt: order.created_at,
        receiptUrl: order.receipt_url,
        test: order.provider === 'test' || order.billing.test === true,
        total: order.billing.total || null,
      },
      { headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } },
    );
  } catch (error) {
    return apiError(error);
  }
}
