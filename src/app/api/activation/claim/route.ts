import { apiError, requireAccess, assertSameOrigin } from '@/lib/access';
import { claimPaidOrders } from '@/lib/payments';
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const access = await requireAccess(request);
    const claimed = await claimPaidOrders(access.user.id, access.user.email);
    return Response.json({ claimed });
  } catch (error) {
    return apiError(error);
  }
}
