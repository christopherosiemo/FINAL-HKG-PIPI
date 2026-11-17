import { loadWorkspace, mutateWorkspace } from '@/lib/domain';
import { assertSameOrigin, rateLimit } from '@/lib/access';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    return Response.json(
      await loadWorkspace(
        request,
        new URL(request.url).searchParams.get('organisationId') ?? undefined,
      ),
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    const e = error as Error & { status?: number };
    if (!e.status) console.error('Workspace load failed', e.name);
    return Response.json(
      { error: e.status ? e.message : 'The workspace could not be loaded.' },
      { status: e.status ?? 500 },
    );
  }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await rateLimit(request, 'workspace-mutation', 120);
    return Response.json(await mutateWorkspace(request, await request.json()));
  } catch (error) {
    const e = error as Error & { status?: number };
    if (!e.status) console.error('Workspace mutation failed', e.name);
    return Response.json(
      { error: e.status ? e.message : 'The workspace change could not be saved.' },
      { status: e.status ?? 500 },
    );
  }
}
