import { sql } from '@/lib/db';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    await sql('SELECT 1');
    return Response.json(
      { status: 'ok', service: 'hkgpipi', time: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json(
      { status: 'unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
