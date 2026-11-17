import { AccountNav } from '@/components/account-shell';
import { AccountForm } from '@/components/account-forms';
export const metadata = { title: 'Create an account', robots: { index: false, follow: false } };
export default function Page() {
  return (
    <section className="page-shell account-shell">
      <AccountNav />
      <p className="eyebrow">Account activation</p>
      <h1>Create your secure account.</h1>
      <p>
        Use the email from your order or invitation. Verify your email before accessing an
        engagement.
      </p>
      <AccountForm mode="signup" />
    </section>
  );
}
