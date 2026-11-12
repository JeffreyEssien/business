import { requirePublicStore } from '@/modules/portfolio/guards';

/** Commerce route: portfolios have no products, cart, or checkout. */
export default async function PublicStoreOnlyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  await requirePublicStore((await params).slug);
  return children;
}
