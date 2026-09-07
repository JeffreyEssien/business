import { StorefrontRenderer } from '@/components/storefront/storefront-renderer';
import { getSiteEditor } from '@/modules/content/queries';

export const metadata = { title: 'Storefront draft preview' };
export default async function StorefrontPreviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const editor = await getSiteEditor(slug);
  return (
    <StorefrontRenderer
      slug={slug}
      configuration={editor.configuration}
      products={editor.products}
      preview
    />
  );
}
