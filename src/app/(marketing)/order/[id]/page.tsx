import { OrderStatus } from '@/components/order-status';
export const metadata = { title: 'Order Status', robots: { index: false, follow: false } };
export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ access?: string }>;
}) {
  const [{ id }, { access }] = await Promise.all([params, searchParams]);
  return (
    <main id="main-content" className="page-shell">
      <OrderStatus orderId={id} access={access} />
    </main>
  );
}
