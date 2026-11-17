import { AccountNav } from '@/components/account-shell';
import { AccountForm } from '@/components/account-forms';
export const metadata = { title: 'Choose a new password', robots: { index: false, follow: false } };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <section className="page-shell account-shell">
      <AccountNav />
      <p className="eyebrow">Account recovery</p>
      <h1>Choose a new password.</h1>
      <AccountForm mode="reset" token={token} />
    </section>
  );
}
