import { AccountNav } from '@/components/account-shell';
import { AccountSecurity } from '@/components/account-security';
export const metadata = { title: 'Account security', robots: { index: false, follow: false } };
export default function Page() {
  return (
    <section className="page-shell account-shell">
      <AccountNav />
      <p className="eyebrow">Account security</p>
      <h1>Protect your account.</h1>
      <p>Use an authenticator app and store your recovery codes securely.</p>
      <AccountSecurity />
    </section>
  );
}
