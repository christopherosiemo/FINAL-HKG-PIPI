import { auth } from '@/lib/auth';
import { clientIp } from '@/lib/client-ip';
export const runtime = 'nodejs';
async function trustedRequest(request: Request) {
  const headers = new Headers(request.headers);
  headers.set('x-hkg-client-ip', clientIp(request));
  // Construct from the URL, not Next's cross-realm Request proxy. Bound the
  // JSON authentication payload before handing it to the maintained handler.
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader)
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 65536) {
        await reader.cancel();
        throw new RangeError('Authentication payload exceeds 64 KB.');
      }
      chunks.push(value);
    }
  return new Request(request.url, {
    method: request.method,
    headers,
    body: reader ? Buffer.concat(chunks).toString('utf8') : undefined,
  });
}
async function handle(request: Request) {
  try {
    return await auth.handler(await trustedRequest(request));
  } catch (error) {
    if (error instanceof RangeError)
      return Response.json({ error: 'Authentication request is too large.' }, { status: 413 });
    console.error(
      'authentication_request_failed',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return Response.json(
      { error: 'Authentication request could not be completed.' },
      { status: 500 },
    );
  }
}
export const GET = handle;
export const POST = handle;
