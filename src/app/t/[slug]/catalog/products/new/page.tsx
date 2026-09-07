import { getCatalogWorkspace } from '@/modules/catalog/queries';
import { WorkspaceNavigation } from '@/components/catalog/workspace-navigation';
import { ProductForm } from '@/components/catalog/product-form';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';

export const metadata = { title: 'New product' };
export default async function NewProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant, categories } = await getCatalogWorkspace(slug);
  return (
    <main className="tenant-home">
      <WorkspaceNavigation name={tenant.name} slug={slug} />
      <PageHeader
        eyebrow="CATALOG"
        title="Add a product"
        description="Start in draft or make the product visible as soon as it is saved."
      />
      <Panel>
        <ProductForm slug={slug} categories={categories} />
      </Panel>
    </main>
  );
}
