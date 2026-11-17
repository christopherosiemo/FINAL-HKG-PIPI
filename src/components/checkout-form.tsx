'use client';
import { useState, useEffect, type FormEvent } from 'react';
import Link from 'next/link';
type CommerceConfig = {
  ready: boolean;
  test: boolean;
  stripeTestMode: boolean;
  termsUrl: string;
  termsVersion: string;
  taxLabel: string;
  taxMode: string;
  amount: number;
  offerTitle?: string;
  existingOrderId?: string;
  existingOrderStatus?: string;
  existingCheckoutUrl?: string;
  error?: string;
};
export function CheckoutForm({
  proposalId,
  quotedAmount,
}: { proposalId?: string; quotedAmount?: number } = {}) {
  const [requestId] = useState(() => crypto.randomUUID());
  const [config, setConfig] = useState<CommerceConfig | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch(
      '/api/v1/orders/config' + (proposalId ? '?proposalId=' + encodeURIComponent(proposalId) : ''),
    )
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setConfig(d);
      })
      .catch(() =>
        setError(
          'Ordering configuration could not be loaded. Please try again or contact enquiries@hkgpipi.com.',
        ),
      );
  }, [proposalId]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!config?.ready) return;
    setBusy(true);
    setError('');
    const form = new FormData(e.currentTarget);
    try {
      const r = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.get('name'),
          email: form.get('email'),
          company: form.get('company'),
          billingAddress: {
            line1: form.get('line1'),
            line2: form.get('line2'),
            city: form.get('city'),
            postalCode: form.get('postalCode'),
            country: String(form.get('country')).toUpperCase(),
          },
          acceptTerms: form.get('acceptTerms') === 'on',
          termsVersion: config.termsVersion,
          proposalId,
          requestId,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      window.location.assign(d.checkoutUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout could not be started.');
      setBusy(false);
    }
  }
  if (config?.existingOrderId)
    return (
      <div className="panel">
        <div className="eyebrow">PAYMENT RECORD</div>
        <h2>An order already exists.</h2>
        <p className="section-description">
          This approved request already has an order ({config.existingOrderStatus}). Review its
          recorded status before creating another payment.
        </p>
        <Link className="button" href={`/order/${config.existingOrderId}`}>
          View order
        </Link>
        {config.existingCheckoutUrl && (
          <a className="button button-secondary" href={config.existingCheckoutUrl}>
            Resume secure checkout
          </a>
        )}
      </div>
    );
  return (
    <form className="panel checkout-form" onSubmit={submit}>
      <div className="order-review">
        <p className="eyebrow">
          {proposalId
            ? config?.offerTitle || 'Approved engagement payment'
            : '14-Day AWS Savings Sprint'}
        </p>
        <h2>
          {new Intl.NumberFormat('en-GB', {
            style: 'currency',
            currency: 'GBP',
            maximumFractionDigits: 2,
          }).format((config?.amount || quotedAmount || 500000) / 100)}{' '}
          <small>{proposalId ? 'approved payment request' : 'upfront'}</small>
        </h2>
        <p>
          {proposalId
            ? 'Payment is available only after your implementation scope and terms have been agreed.'
            : 'A ranked Savings Ledger, supporting evidence and a specific implementation roadmap. Discovery uses tightly constrained read-only access.'}
        </p>
        <p>{config?.taxLabel || 'Loading commercial details…'}</p>
        {(config?.test || config?.stripeTestMode) && (
          <p className="status">
            {config.test ? 'LOCAL TEST CHECKOUT' : 'STRIPE TEST CHECKOUT'} — no real payment will be
            taken.
          </p>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {config && !config.ready && (
        <div className="status" role="status">
          <h3>Online ordering is being prepared.</h3>
          <p>
            Approved checkout terms, tax treatment and secure payment configuration must be in place
            before we accept an order. You can discuss the Sprint with{' '}
            <a href="mailto:enquiries@hkgpipi.com">enquiries@hkgpipi.com</a>.
          </p>
        </div>
      )}
      <fieldset disabled={!config?.ready || busy}>
        <legend>Your company and billing details</legend>
        <div className="form-grid">
          <label className="field">
            Full name
            <input name="name" autoComplete="name" required minLength={2} maxLength={100} />
          </label>
          <label className="field">
            Work email
            <input type="email" name="email" autoComplete="email" required maxLength={254} />
            <small>Use this email to activate your account after payment.</small>
          </label>
          <label className="field">
            Company name
            <input
              name="company"
              autoComplete="organization"
              required
              minLength={2}
              maxLength={160}
            />
          </label>
          <label className="field">
            Billing address
            <input
              name="line1"
              autoComplete="address-line1"
              required
              minLength={3}
              maxLength={200}
            />
          </label>
          <label className="field">
            Address line 2 <span>(optional)</span>
            <input name="line2" autoComplete="address-line2" maxLength={200} />
          </label>
          <label className="field">
            Town or city
            <input
              name="city"
              autoComplete="address-level2"
              required
              minLength={2}
              maxLength={100}
            />
          </label>
          <label className="field">
            Postcode
            <input
              name="postalCode"
              autoComplete="postal-code"
              required
              minLength={2}
              maxLength={20}
            />
          </label>
          <label className="field">
            Country
            <select name="country" autoComplete="country" defaultValue="GB" required>
              {[
                ['GB', 'United Kingdom'],
                ['IE', 'Ireland'],
                ['US', 'United States'],
                ['CA', 'Canada'],
                ['DE', 'Germany'],
                ['FR', 'France'],
                ['NL', 'Netherlands'],
                ['AU', 'Australia'],
                ['SG', 'Singapore'],
                ['HK', 'Hong Kong'],
                ['AE', 'United Arab Emirates'],
                ['KE', 'Kenya'],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="checkbox-field">
          <input name="acceptTerms" type="checkbox" required />{' '}
          <span>
            I have authority to order for this company and accept the{' '}
            {config?.termsUrl ? (
              <a href={config.termsUrl} target="_blank" rel="noopener noreferrer">
                engagement terms ({config.termsVersion})
              </a>
            ) : (
              'engagement terms'
            )}{' '}
            and the <Link href="/privacy">Privacy Policy</Link>.
          </span>
        </label>
        <p>
          Card details are collected by Stripe. Your order is confirmed only after payment has been
          verified. AWS access is a separate, controlled onboarding step.
        </p>
        <button className="button" disabled={!config?.ready || busy}>
          {busy
            ? 'Preparing secure checkout…'
            : config?.test
              ? 'Continue to local test checkout'
              : 'Continue to secure payment'}
        </button>
      </fieldset>
    </form>
  );
}
