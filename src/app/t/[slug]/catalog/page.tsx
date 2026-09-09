import { CATALOG_PAGE_SIZE, getCatalogWorkspace } from '@/modules/catalog/queries';
import { WorkspaceNavigation } from '@/components/catalog/workspace-navigation';
import { CatalogList } from '@/components/catalog/catalog-list';
import { Button, ButtonLink } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import styles from '@/components/catalog/catalog.module.css';
import { Pagination } from '@/components/ui/pagination';

export const metadata = { title: 'Catalog' };
export default async function CatalogPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; search?: string; status?: string }>;
}) {
  const { slug } = await params;
  const filters = await searchParams;
  const { tenant, products, categories, total, activeTotal, page, search, status } =
    await getCatalogWorkspace(slug, {
      page: Number(filters.page) || 1,
      search: filters.search,
      status: filters.status,
    });
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
          Matching products<strong>{total}</strong>
        </div>
        <div className={styles.metric}>
          Active<strong>{activeTotal}</strong>
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
        <form className={styles.catalogFilters}>
          <input
            name="search"
            aria-label="Search products"
            placeholder="Search product names"
            defaultValue={search}
          />
          <select name="status" aria-label="Filter products by status" defaultValue={status}>
            <option value="">Every status</option>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          <Button type="submit" variant="secondary">
            Apply filters
          </Button>
        </form>
        <CatalogList slug={slug} products={products} />
        <Pagination
          total={total}
          page={page}
          pageSize={CATALOG_PAGE_SIZE}
          href={(nextPage) =>
            `/t/${slug}/catalog?${new URLSearchParams({ page: String(nextPage), ...(search && { search }), ...(status && { status }) })}`
          }
        />
      </Panel>
    </main>
  );
}
