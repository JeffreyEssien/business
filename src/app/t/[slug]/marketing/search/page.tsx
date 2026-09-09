import { WorkspaceNavigation } from '@/components/catalog/workspace-navigation';
import { SearchAppearanceForm } from '@/components/seo/search-appearance-form';
import { SearchContentList } from '@/components/seo/search-content-list';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { getSeoWorkspace, SEO_PRODUCT_PAGE_SIZE } from '@/modules/seo/queries';
import { Pagination } from '@/components/ui/pagination';

export const metadata = { title: 'Search appearance' };
export default async function SearchAppearancePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ productSearch?: string; productPage?: string }>;
}) {
  const { slug } = await params;
  const filters = await searchParams;
  const data = await getSeoWorkspace(slug, filters.productSearch, Number(filters.productPage) || 1);
  return (
    <main className="tenant-home">
      <WorkspaceNavigation name={data.workspace.tenant.name} slug={slug} />
      <PageHeader
        eyebrow="HELP CUSTOMERS FIND YOU"
        title="Search appearance"
        description="Choose how your storefront should be introduced when people find it through Google, Bing, or a shared social link. You can review saved wording before making it public."
      />
      <div className="section-stack">
        <Panel>
          <SearchAppearanceForm slug={slug} settings={data.settings} />
        </Panel>
        <Panel
          title="Search wording for individual store pages"
          description="Your store defaults are used automatically. Customize only the pages that need different wording when people find or share them."
        >
          <form className="inline-filter">
            <input
              name="productSearch"
              aria-label="Search product pages"
              placeholder="Search product pages"
              defaultValue={data.productSearch}
            />
            <button type="submit">Search</button>
          </form>
          <SearchContentList slug={slug} records={data.records} entries={data.entries} />
          <Pagination
            total={data.productTotal}
            page={data.productPage}
            pageSize={SEO_PRODUCT_PAGE_SIZE}
            href={(nextPage) =>
              `/t/${slug}/marketing/search?${new URLSearchParams({ productPage: String(nextPage), ...(data.productSearch && { productSearch: data.productSearch }) })}`
            }
          />
        </Panel>
      </div>
    </main>
  );
}
