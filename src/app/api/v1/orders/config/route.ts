import { publicCommerceConfig } from '@/lib/config';
import { getProposalPricing } from '@/lib/payments';
export async function GET(request: Request) {
  try {
    const proposalId = new URL(request.url).searchParams.get('proposalId');
    const price = proposalId ? await getProposalPricing(proposalId, request) : null;
    return Response.json(
      {
        ...publicCommerceConfig(),
        ...(price
          ? {
              amount: price.amount,
              offerTitle: price.title,
              offer: price.offer,
              existingOrderId: price.existingOrderId,
              existingOrderStatus: price.existingOrderStatus,
              existingCheckoutUrl: price.existingCheckoutUrl,
            }
          : {}),
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return Response.json(
      {
        ready: false,
        error:
          (error as { status?: number }).status && error instanceof Error
            ? error.message
            : 'Payment configuration is unavailable.',
      },
      { status: (error as { status?: number }).status || 503 },
    );
  }
}
