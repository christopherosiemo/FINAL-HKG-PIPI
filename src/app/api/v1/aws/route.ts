import { awsAction, listConnections, awsEvidence, awsTechnicalEvidence } from '@/lib/aws';
import { assertSameOrigin, rateLimit } from '@/lib/access';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams,
      organisationId = params.get('organisationId');
    if (!organisationId)
      return Response.json({ error: 'Select an organisation.' }, { status: 400 });
    const view = params.get('view'),
      connectionId = params.get('connectionId') ?? '';
    if (view === 'technical')
      return Response.json(
        await awsTechnicalEvidence(
          request,
          organisationId,
          connectionId,
          params.get('checkId') ?? '',
        ),
        {
          headers: {
            'Cache-Control': 'private, no-store',
            'Content-Disposition': 'attachment; filename="aws-read-only-evidence.json"',
            'X-Content-Type-Options': 'nosniff',
          },
        },
      );
    return Response.json(
      view === 'evidence'
        ? await awsEvidence(
            request,
            organisationId,
            connectionId,
            Number(params.get('offset') ?? 0),
          )
        : await listConnections(request, organisationId),
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    const e = error as Error & { status?: number };
    if (!e.status) console.error('AWS list failed', e.name);
    return Response.json(
      { error: e.status ? e.message : 'Unable to load AWS connections.' },
      { status: e.status ?? 500 },
    );
  }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await rateLimit(request, 'aws-action', 20);
    return Response.json(await awsAction(request, await request.json()));
  } catch (error) {
    const e = error as Error & { status?: number };
    if (!e.status) console.error('AWS action failed', e.name);
    return Response.json(
      {
        error: e.status
          ? e.message
          : 'AWS request failed. Review the connection diagnostics in the portal.',
      },
      { status: e.status ?? 502 },
    );
  }
}
