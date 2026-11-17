import { apiError, assertSameOrigin, rateLimit } from '@/lib/access';
import { createOrder } from '@/lib/payments';
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await rateLimit(request, 'checkout', 5);
    if (Number(request.headers.get('content-length') || 0) > 12000)
      return Response.json({ error: 'Request too large.' }, { status: 413 });
    return Response.json(await createOrder(await request.json(), request), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
