import { requireAccess, apiError, assertSameOrigin, AccessError } from '@/lib/access';
import { reconcilePayments } from '@/lib/payments';
import { sql } from '@/lib/db';
export async function GET(request: Request) {
  try {
    await requireAccess(request, { staff: true });
    const orders = await sql(
      'SELECT id,status,email,company,amount,currency,provider,last_reconciled_at,reconciliation_error,billing FROM orders ORDER BY created_at DESC LIMIT 200',
    );
    const events = await sql(
      'SELECT id,type,order_id,detail,received_at,processed_at FROM payment_events ORDER BY received_at DESC LIMIT 200',
    );
    const reconciliations = await sql(
      'SELECT * FROM payment_reconciliations ORDER BY created_at DESC LIMIT 100',
    );
    return Response.json(
      { orders, events, reconciliations },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const access = await requireAccess(request, { staff: true });
    const body = await request.json();
    if (body.orderId && typeof body.orderId !== 'string')
      throw new AccessError('Invalid order reference.', 400);
    return Response.json(await reconcilePayments(body.orderId, access.user.id));
  } catch (error) {
    return apiError(error);
  }
}
