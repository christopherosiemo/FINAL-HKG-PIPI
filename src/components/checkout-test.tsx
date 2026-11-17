'use client';
import { useState } from 'react';
export function TestCheckout({
  id,
  access,
  amount,
}: {
  id: string;
  access: string;
  amount: number;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function pay(outcome: 'pay' | 'fail') {
    setBusy(true);
    try {
      const r = await fetch('/api/payments/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, access, outcome }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      window.location.assign(d.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Test payment failed.');
      setBusy(false);
    }
  }
  return (
    <div className="panel">
      <p className="badge">LOCAL DEVELOPMENT ADAPTER</p>
      <h1>Test the payment journey.</h1>
      <p>
        This is an explicit local payment simulator. It does not contact Stripe and charges no
        money. It is prohibited in production.
      </p>
      <h2>
        {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(
          amount / 100,
        )}
      </h2>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="button" disabled={busy} onClick={() => pay('pay')}>
        Simulate confirmed test payment
      </button>
      <button className="button-secondary" disabled={busy} onClick={() => pay('fail')}>
        Simulate payment failure
      </button>
    </div>
  );
}
