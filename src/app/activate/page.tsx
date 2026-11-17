import { AccountNav } from '@/components/account-shell';
import { ActivationPanel } from '@/components/account-forms';
export const metadata = {
  title: 'Activate your engagement',
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <section className="page-shell account-shell">
      <AccountNav />
      <p className="eyebrow">Secure onboarding</p>
      <h1>Your engagement starts here.</h1>
      <p>Verify your email, link your order and complete the onboarding checklist.</p>
      <ActivationPanel />
    </section>
  );
}
