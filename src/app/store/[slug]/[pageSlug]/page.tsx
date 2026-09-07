import { notFound } from 'next/navigation';
import { StorefrontContentPage } from '@/components/storefront/storefront-renderer';
import { getPublicStorefront } from '@/modules/catalog/queries';

export default async function PublicInformationPage({
  params,
}: {
  params: Promise<{ slug: string; pageSlug: string }>;
}) {
  const { slug, pageSlug } = await params;
  const store = await getPublicStorefront(slug);
  if (!store.site) notFound();
  const page = (store.site.pages ?? []).find((item) => item.slug === pageSlug);
  if (!page) notFound();
  return <StorefrontContentPage slug={slug} configuration={store.site} page={page} />;
}
