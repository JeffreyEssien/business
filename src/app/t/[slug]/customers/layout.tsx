import { requireStoreWorkspace } from '@/modules/portfolio/guards';

/** Store-only workspace area: portfolios receive a 404 instead of commerce screens. */
export default async function StoreOnlyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  await requireStoreWorkspace((await params).slug);
  return children;
}
