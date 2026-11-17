import type { Metadata } from 'next';
import { Check, ShieldCheck } from 'lucide-react';
import { PageHero } from '@/components/marketing';
import { CheckoutForm } from '@/components/checkout-form';
import { getProposalPricing } from '@/lib/payments';
import { getAccess } from '@/lib/access';
import { redirect } from 'next/navigation';
import Link from 'next/link';
export const metadata: Metadata = {
  title: 'Start Your Savings Sprint',
  robots: { index: false, follow: true },
};
export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{ proposal?: string }>;
}) {
  const { proposal } = await searchParams;
  let price: Awaited<ReturnType<typeof getProposalPricing>> | null = null;
  if (proposal) {
    if (!(await getAccess()))
      redirect('/login?next=' + encodeURIComponent('/start?proposal=' + proposal));
    try {
      price = await getProposalPricing(proposal);
    } catch (error) {
      return (
        <main id="main-content">
          <PageHero label="ENGAGEMENT PAYMENT" title="This payment request is not available.">
            <p>
              {(error as { status?: number }).status && error instanceof Error
                ? error.message
                : 'The payment request could not be loaded.'}
            </p>
            <Link className="button" href="/portal/proposals">
              Return to engagement proposals
            </Link>
          </PageHero>
        </main>
      );
    }
  }
  const outcome = price?.offer === 'outcome';
  return (
    <main id="main-content">
      <PageHero
        label={
          outcome
            ? 'APPROVED OUTCOME PAYMENT'
            : proposal
              ? 'AGREED IMPLEMENTATION'
              : 'START YOUR ENGAGEMENT'
        }
        title={
          proposal
            ? 'Put your approved scope into motion.'
            : 'Your first step towards lower AWS waste.'
        }
      >
        <p>
          {proposal
            ? 'Review your accepted implementation proposal and continue to secure checkout.'
            : 'Review the 14-Day AWS Savings Sprint, enter your company details and continue to secure checkout.'}
        </p>
      </PageHero>
      <div className="page-shell purchase-grid">
        <aside className="purchase-summary">
          <div className="eyebrow">{price?.title || '14-DAY AWS SAVINGS SPRINT'}</div>
          <h2>
            {proposal ? (
              <>
                Approved engineering.
                <br />
                Customer-controlled delivery.
              </>
            ) : (
              <>
                A focused discovery.
                <br />
                An actionable result.
              </>
            )}
          </h2>
          <div className="offer-price">
            {new Intl.NumberFormat('en-GB', {
              style: 'currency',
              currency: 'GBP',
              maximumFractionDigits: 2,
            }).format((price?.amount || 500000) / 100)}{' '}
            <small>
              {outcome
                ? 'explicitly approved verified-savings payment'
                : proposal
                  ? 'agreed fixed scope'
                  : 'upfront'}{' '}
              · tax treatment shown before payment
            </small>
          </div>
          <ul>
            {(outcome
              ? [
                  'Accepted outcome agreement',
                  'Published verification evidence',
                  'Agreed fee base and contractual conditions',
                  '25% fee calculated on the server',
                  'Explicit customer payment approval',
                ]
              : proposal
                ? [
                    'Accepted scope and terms required',
                    'Engineering changes and technical evidence',
                    'Your review and testing controls',
                    'Customer-authorised deployment',
                    'Baseline and verification support',
                  ]
                : [
                    'Ranked savings ledger',
                    'Commitment and Savings Plan exposure',
                    'Idle resources and architecture analysis',
                    'Specific remediation recommendations',
                    'IaC references where identifiable',
                    'Evidence and implementation roadmap',
                  ]
            ).map((x) => (
              <li key={x}>
                <Check size={15} />
                {x}
              </li>
            ))}
          </ul>
          <div className="callout">
            <ShieldCheck size={18} />
            <p>
              {proposal
                ? 'Implementation follows the agreed scope and your existing engineering controls.'
                : 'Constrained read-only discovery. No infrastructure changes during this engagement.'}
            </p>
          </div>
          <p className="form-note">
            Implementation follows separately agreed scope. Your engineering approvals and
            deployment controls remain authoritative.
          </p>
        </aside>
        <CheckoutForm proposalId={proposal} quotedAmount={price?.amount} />
      </div>
    </main>
  );
}
