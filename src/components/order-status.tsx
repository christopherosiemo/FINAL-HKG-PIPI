'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
type Order = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  offer: string;
  test: boolean;
  receiptUrl?: string;
  total?: number;
};
export function OrderStatus({
  orderId,
  access: accessToken,
}: {
  orderId: string;
  access?: string;
}) {
  const [order, setOrder] = useState<Order | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    let live = true,
      count = 0;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const query = accessToken ? `?access=${encodeURIComponent(accessToken)}` : '';
        const r = await fetch(`/api/v1/orders/${encodeURIComponent(orderId)}${query}`, {
          cache: 'no-store',
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        if (live) {
          setOrder(d);
          if (d.status === 'pending' && count++ < 20) timer = setTimeout(load, 3000);
        }
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : 'Order status unavailable.');
      }
    }
    void load();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [orderId, accessToken]);
  if (error)
    return (
      <div className="panel">
        <p className="error" role="alert">
          {error}
        </p>
        <Link href="/login">Sign in to view your orders</Link>
      </div>
    );
  if (!order)
    return (
      <div className="panel" role="status">
        Checking payment confirmation…
      </div>
    );
  const confirmed = ['paid', 'partial_refunded'].includes(order.status);
  return (
    <div className="panel order-status" aria-live="polite">
      {order.test && <p className="badge">TEST ORDER · no real money charged</p>}
      <p className="eyebrow">Order {order.id.slice(0, 8).toUpperCase()}</p>
      <h2>
        {order.status === 'paid'
          ? order.offer === 'outcome'
            ? 'Your outcome payment is confirmed.'
            : 'Your engagement is confirmed.'
          : order.status === 'partial_refunded'
            ? 'A partial refund has been recorded.'
            : order.status === 'disputed'
              ? 'Payment requires review.'
              : order.status === 'pending'
                ? 'Waiting for payment confirmation.'
                : order.status === 'refunded'
                  ? 'Payment refunded.'
                  : order.status === 'cancelled'
                    ? 'Order cancelled.'
                    : 'Payment was not completed.'}
      </h2>
      <p>
        {order.offer === 'savings-sprint'
          ? '14-Day AWS Savings Sprint'
          : order.offer === 'outcome'
            ? 'Approved outcome-based implementation payment'
            : 'Implementation Sprint'}{' '}
        ·{' '}
        {new Intl.NumberFormat('en-GB', { style: 'currency', currency: order.currency }).format(
          (order.total || order.amount) / 100,
        )}
      </p>
      {confirmed ? (
        <>
          <p>
            Your order has been recorded. Activate an account using the ordering email to complete
            secure onboarding. Your billing history reflects any provider-confirmed refund.
          </p>
          <Link
            className="button"
            href={order.offer === 'outcome' ? '/portal/billing' : '/activate'}
          >
            {order.offer === 'outcome' ? 'View billing & orders' : 'Activate your engagement'}
          </Link>
          {order.receiptUrl && (
            <a
              className="button-secondary"
              href={order.receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              View payment receipt
            </a>
          )}
        </>
      ) : order.status === 'pending' ? (
        <>
          <p>
            A return from checkout does not confirm payment. This page checks the verified payment
            record. If your payment is still processing, return shortly or contact us with the order
            reference.
          </p>
          <button
            className="button-secondary"
            onClick={async () => {
              try {
                const r = await fetch(`/api/v1/orders/${orderId}/cancel`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ access: accessToken }),
                });
                const d = await r.json();
                if (!r.ok) throw new Error(d.error);
                setOrder({ ...order, status: d.status });
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Cancellation failed.');
              }
            }}
          >
            Cancel unpaid order
          </button>
        </>
      ) : (
        <>
          <p>
            {order.status === 'disputed'
              ? 'Contact HKGpipi to resolve the payment review. Your existing workspace remains available to authorised account holders.'
              : 'If you need help, contact enquiries@hkgpipi.com with your order reference.'}
          </p>
          <Link className="button" href={order.status === 'disputed' ? '/contact' : '/start'}>
            {order.status === 'disputed' ? 'Contact HKGpipi' : 'Start a new order'}
          </Link>
        </>
      )}
    </div>
  );
}
