import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getAccess } from '@/lib/access';
import WorkspaceApp from '@/components/workspace';
export const metadata: Metadata = {
  title: 'Customer workspace',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';
export default async function PortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ view?: string[] }>;
  searchParams: Promise<{ demo?: string; invite?: string; organisationId?: string }>;
}) {
  const [{ view }, query] = await Promise.all([params, searchParams]);
  if (query.demo === '1') return <WorkspaceApp view={view} demo />;
  const access = await getAccess();
  if (!access)
    redirect(
      '/login?next=' +
        encodeURIComponent(
          `/portal${view?.length ? '/' + view.join('/') : ''}${query.invite ? '?invite=' + encodeURIComponent(query.invite) : ''}`,
        ),
    );
  if (!access.user.emailVerified) redirect('/activate');
  if (access.isStaff && !access.user.twoFactorEnabled) redirect('/account-security');
  if (access.isStaff && !access.mfaSessionVerified) redirect('/login?next=/admin');
  return (
    <WorkspaceApp
      key={query.organisationId}
      initialOrganisationId={query.organisationId}
      view={view}
      inviteToken={query.invite}
    />
  );
}
