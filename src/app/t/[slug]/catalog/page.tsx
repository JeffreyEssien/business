import { getCatalogWorkspace } from '@/modules/catalog/queries';
import { WorkspaceNavigation } from '@/components/catalog/workspace-navigation';
import { CatalogList } from '@/components/catalog/catalog-list';
import { ButtonLink } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import styles from '@/components/catalog/catalog.module.css';

export const metadata = { title: 'Catalog' };
export default async function CatalogPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant, products, categories } = await getCatalogWorkspace(slug);
  return (
    <main className="tenant-home">
      <WorkspaceNavigation name={tenant.name} slug={slug} />
      <PageHeader
        eyebrow="CATALOG"
        title="Products"
        description="Manage what customers can browse in your public store."
        action={<ButtonLink href={`/t/${slug}/catalog/products/new`}>Add product</ButtonLink>}
      />
      <div className={styles.summary}>
        <div className={styles.metric}>
          All products<strong>{products.length}</strong>
        </div>
        <div className={styles.metric}>
          Active<strong>{products.filter((item) => item.status === 'ACTIVE').length}</strong>
        </div>
        <div className={styles.metric}>
          Categories<strong>{categories.length}</strong>
        </div>
      </div>
      <Panel
        title="Product catalog"
        action={
          <ButtonLink variant="secondary" href={`/t/${slug}/catalog/categories`}>
            Manage categories
          </ButtonLink>
        }
        padded={false}
      >
        <CatalogList slug={slug} products={products} />
      </Panel>
    </main>
  );
}
