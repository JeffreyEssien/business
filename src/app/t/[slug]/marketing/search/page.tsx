import { WorkspaceNavigation } from '@/components/catalog/workspace-navigation';
import { SearchAppearanceForm } from '@/components/seo/search-appearance-form';
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
      <Panel>
        <SearchAppearanceForm slug={slug} settings={data.settings} />
      </Panel>
    </main>
  );
}
