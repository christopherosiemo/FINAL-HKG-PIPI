import { AccountNav } from '@/components/account-shell';
import { AccountForm } from '@/components/account-forms';
export const metadata = { title: 'Password recovery', robots: { index: false, follow: false } };
export default function Page() {
  return (
    <section className="page-shell account-shell">
      <AccountNav />
      <p className="eyebrow">Account recovery</p>
      <h1>Reset your password.</h1>
      <p>We will send a recovery link to your registered email.</p>
      <AccountForm mode="forgot" />
    </section>
  );
}
