import { uploadFile, downloadFile } from '@/lib/storage';
import { assertSameOrigin, rateLimit } from '@/lib/access';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await rateLimit(request, 'file-upload', 15);
    return Response.json(await uploadFile(request), { status: 201 });
  } catch (error) {
    const e = error as Error & { status?: number };
    if (!e.status) console.error('Private upload failed', e.name);
    return Response.json(
      { error: e.status ? e.message : 'Unable to store this file. Please retry.' },
      { status: e.status ?? 500 },
    );
  }
}
export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return Response.json({ error: 'File ID is required.' }, { status: 400 });
    return await downloadFile(request, id);
  } catch (error) {
    const e = error as Error & { status?: number };
    if (!e.status) console.error('Private download failed', e);
    return Response.json(
      { error: e.status ? e.message : 'Unable to download this file.' },
      { status: e.status ?? 500 },
    );
  }
}
