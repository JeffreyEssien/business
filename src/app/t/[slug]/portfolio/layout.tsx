import { requirePortfolioWorkspace } from '@/modules/portfolio/guards';

/** Portfolio-only workspace area: stores receive a 404. */
export default async function PortfolioOnlyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  await requirePortfolioWorkspace((await params).slug);
  return children;
}
