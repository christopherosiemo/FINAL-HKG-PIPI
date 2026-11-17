import { notFound } from 'next/navigation';
import { commercialConfig } from '@/lib/config';
import { sql } from '@/lib/db';
import { OrderRow, secureEqual } from '@/lib/payments';
import { TestCheckout } from '@/components/checkout-test';
export const metadata = { title: 'Local test checkout', robots: { index: false, follow: false } };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ access?: string }>;
}) {
  try {
    if (!commercialConfig().test) notFound();
  } catch {
    notFound();
  }
  const { id } = await params;
  const { access } = await searchParams;
  const [order] = await sql<OrderRow>('SELECT * FROM orders WHERE id=$1', [id]);
  if (!order || order.provider !== 'test' || !access || !secureEqual(access, order.checkout_key))
    notFound();
  return (
    <section className="page-shell account-shell">
      <TestCheckout id={id} access={access} amount={Number(order.amount)} />
    </section>
  );
}
