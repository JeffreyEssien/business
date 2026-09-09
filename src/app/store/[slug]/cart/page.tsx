import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CartCheckout } from '@/components/commerce/cart-checkout';
import { StorefrontShell } from '@/components/storefront/storefront-renderer';
import { getPublicStorefront } from '@/modules/catalog/queries';

export const metadata: Metadata = { title: 'Your cart', robots: { index: false, follow: false } };

export default async function CartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getPublicStorefront(slug);
  if (!store.site) notFound();
  return (
    <StorefrontShell slug={slug} configuration={store.site}>
      <main>
        <CartCheckout slug={slug} step="cart" />
      </main>
    </StorefrontShell>
  );
}
