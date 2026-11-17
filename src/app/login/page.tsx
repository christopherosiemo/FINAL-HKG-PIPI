import { AccountNav } from '@/components/account-shell';
import { AccountForm } from '@/components/account-forms';
export const metadata = { title: 'Sign in', robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <section className="page-shell account-shell">
      <AccountNav />
      <p className="eyebrow">Customer workspace</p>
      <h1>Sign in to HKGpipi.</h1>
      <p>Follow your engagement from discovery to verified savings.</p>
      <AccountForm mode="login" next={next} />
    </section>
  );
}
