import { headers } from 'next/headers';
import { createHash } from 'node:crypto';
import { auth } from './auth';
import { sql } from './db';
import { appUrl } from './config';
import { clientIp } from './client-ip';
export class AccessError extends Error {
  constructor(
    message: string,
    public status = 403,
  ) {
    super(message);
  }
}
export type AccessContext = {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    emailVerified: boolean;
    twoFactorEnabled: boolean;
  };
  isStaff: boolean;
  mfaSessionVerified: boolean;
  organisationId: string | null;
  organisationRole: string | null;
};
export async function getAccess(request?: Request): Promise<AccessContext | null> {
  const session = await auth.api.getSession({ headers: request?.headers || (await headers()) });
  if (!session) return null;
  const u = session.user as typeof session.user & { role?: string; twoFactorEnabled?: boolean };
  const [security] = await sql<{
    role: string;
    twoFactorEnabled: boolean;
    mfa_enrolled_at: Date | null;
  }>('SELECT role,"twoFactorEnabled",mfa_enrolled_at FROM "user" WHERE id=$1', [u.id]);
  const members = await sql<{ organizationId: string; role: string }>(
    'SELECT "organizationId",role FROM "member" WHERE "userId"=$1 ORDER BY "createdAt" LIMIT 1',
    [u.id],
  );
  const [proof] = await sql<{ mfa_verified_at: Date | null }>(
    'SELECT mfa_verified_at FROM "session" WHERE id=$1 AND "userId"=$2',
    [session.session.id, u.id],
  );
  return {
    user: {
      id: u.id,
      email: u.email,
      name: u.name,
      role: security?.role || 'customer',
      emailVerified: u.emailVerified,
      twoFactorEnabled: !!security?.twoFactorEnabled,
    },
    isStaff: security?.role === 'admin',
    mfaSessionVerified: !!security?.twoFactorEnabled && !!proof?.mfa_verified_at,
    organisationId: members[0]?.organizationId || null,
    organisationRole: members[0]?.role || null,
  };
}
export async function requireAccess(
  request?: Request,
  options: { organisationId?: string; staff?: boolean } = {},
): Promise<AccessContext> {
  const access = await getAccess(request);
  if (!access) throw new AccessError('Please sign in.', 401);
  if (!access.user.emailVerified)
    throw new AccessError('Verify your email before accessing the workspace.', 403);
  if (access.isStaff && !access.user.twoFactorEnabled)
    throw new AccessError(
      'Administrator access requires authenticator enrollment at /account-security.',
      403,
    );
  if (access.isStaff && !access.mfaSessionVerified)
    throw new AccessError(
      'Sign in again and complete your authenticator challenge before accessing administration.',
      403,
    );
  if (options.staff && !access.isStaff)
    throw new AccessError('Administrator permission required.', 403);
  if (options.organisationId && !access.isStaff) {
    const rows = await sql<{ role: string }>(
      'SELECT role FROM "member" WHERE "organizationId"=$1 AND "userId"=$2',
      [options.organisationId, access.user.id],
    );
    if (!rows.length) throw new AccessError('This organisation is not accessible.', 404);
    access.organisationId = options.organisationId;
    access.organisationRole = rows[0].role;
  }
  return access;
}
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(appUrl()).origin)
    throw new AccessError('Request origin is not permitted.', 403);
}
export async function rateLimit(request: Request, scope: string, max = 8, windowSeconds = 60) {
  const ip = clientIp(request);
  const key = createHash('sha256').update(`${scope}:${ip}`).digest('hex');
  const rows = await sql<{ count: number }>(
    `INSERT INTO request_limits(key,count,reset_at) VALUES($1,1,now()+($2 * interval '1 second')) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN request_limits.reset_at<now() THEN 1 ELSE request_limits.count+1 END,reset_at=CASE WHEN request_limits.reset_at<now() THEN now()+($2 * interval '1 second') ELSE request_limits.reset_at END RETURNING count`,
    [key, windowSeconds],
  );
  if (rows[0].count > max)
    throw new AccessError('Too many requests. Please try again shortly.', 429);
}
export function apiError(error: unknown) {
  if (error instanceof AccessError)
    return Response.json({ error: error.message }, { status: error.status });
  console.error('request_failed', error instanceof Error ? error.name : 'UnknownError');
  return Response.json(
    { error: 'This request could not be completed. Please try again.' },
    { status: 500 },
  );
}
