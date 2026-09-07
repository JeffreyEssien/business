import { getProductEditor } from '@/modules/catalog/queries';
import { WorkspaceNavigation } from '@/components/catalog/workspace-navigation';
import { ProductForm } from '@/components/catalog/product-form';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';

export const metadata = { title: 'Edit product' };
export default async function EditProductPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const { tenant, categories, product } = await getProductEditor(slug, id);
  return (
    <main className="tenant-home">
      <WorkspaceNavigation name={tenant.name} slug={slug} />
      <PageHeader
        eyebrow="CATALOG"
        title={`Edit ${product.name}`}
        description="Changes to active products appear in the public catalog immediately."
      />
      <Panel>
        <ProductForm slug={slug} categories={categories} product={product} />
      </Panel>
    </main>
  );
}
