import { WorkspaceNavigation } from '@/components/catalog/workspace-navigation';
import { SearchAppearanceForm } from '@/components/seo/search-appearance-form';
import { SearchContentList } from '@/components/seo/search-content-list';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { getSeoWorkspace } from '@/modules/seo/queries';

export const metadata = { title: 'Search appearance' };
export default async function SearchAppearancePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getSeoWorkspace(slug);
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
          <SearchContentList slug={slug} records={data.records} entries={data.entries} />
        </Panel>
      </div>
    </main>
  );
}
