import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getAccess } from '@/lib/access';
import WorkspaceApp from '@/components/workspace';
export const metadata: Metadata = { title: 'Operations', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
export default async function AdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ view?: string[] }>;
  searchParams: Promise<{ demo?: string; organisationId?: string }>;
}) {
  const [{ view }, query] = await Promise.all([params, searchParams]);
  if (query.demo === '1') return <WorkspaceApp view={view} admin demo />;
  const access = await getAccess();
  if (!access) redirect('/login?next=/admin');
  if (!access.user.emailVerified) redirect('/activate');
  if (!access.isStaff) redirect('/portal');
  if (!access.user.twoFactorEnabled) redirect('/account-security');
  if (!access.mfaSessionVerified) redirect('/login?next=/admin');
  return (
    <WorkspaceApp
      key={query.organisationId}
      initialOrganisationId={query.organisationId}
      view={view}
      admin
    />
  );
}
