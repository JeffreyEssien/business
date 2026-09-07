import { getCatalogWorkspace } from '@/modules/catalog/queries';
import { WorkspaceNavigation } from '@/components/catalog/workspace-navigation';
import { CategoryManager } from '@/components/catalog/category-manager';
import { ButtonLink } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';

export const metadata = { title: 'Categories' };
export default async function CategoriesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant, categories } = await getCatalogWorkspace(slug);
  return (
    <main className="tenant-home">
      <WorkspaceNavigation name={tenant.name} slug={slug} />
      <PageHeader
        eyebrow="CATALOG"
        title="Categories"
        description="Organize products into customer-friendly collections."
        action={
          <ButtonLink variant="secondary" href={`/t/${slug}/catalog`}>
            Back to products
          </ButtonLink>
        }
      />
      <Panel title="Category manager">
        <CategoryManager slug={slug} categories={categories} />
      </Panel>
    </main>
  );
}
