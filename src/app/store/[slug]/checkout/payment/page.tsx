import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PaystackPaymentStatus } from '@/components/commerce/paystack-payment-status';
import { StorefrontShell } from '@/components/storefront/storefront-renderer';
import { getPublicStorefront } from '@/modules/catalog/queries';
import { getPublicPaystackOrder } from '@/modules/commerce/queries';

export const metadata: Metadata = {
  title: 'Payment status',
  robots: { index: false, follow: false },
};

export default async function PaymentStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ reference?: string; token?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const reference = query.reference ?? '';
  const token = query.token ?? '';
  const [store, order] = await Promise.all([
    getPublicStorefront(slug),
    getPublicPaystackOrder(slug, reference, token),
  ]);
  if (!store.site || !order) notFound();
  return (
    <StorefrontShell slug={slug} configuration={store.site}>
      <main>
        <PaystackPaymentStatus slug={slug} accessToken={token} order={order} />
      </main>
    </StorefrontShell>
  );
}
