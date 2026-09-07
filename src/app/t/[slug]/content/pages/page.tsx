import { WorkspaceNavigation } from '@/components/catalog/workspace-navigation';
import { ContentPageList } from '@/components/content/content-page-list';
import { ButtonLink } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { getContentPagesWorkspace } from '@/modules/content/queries';

export const metadata = { title: 'Website pages' };
export default async function WebsitePagesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getContentPagesWorkspace(slug);
  return (
    <main className="tenant-home">
      <WorkspaceNavigation name={data.workspace.tenant.name} slug={slug} />
      <PageHeader
        eyebrow="CUSTOMER INFORMATION"
        title="Website pages"
        description="Create the helpful pages customers use to learn about your business, contact you, and understand your store policies. Saved changes stay private until you publish them from Store design."
        action={
          <ButtonLink href={`/t/${slug}/content/pages/new`}>Create a customer page</ButtonLink>
        }
      />
      <Panel padded={false}>
        <ContentPageList slug={slug} pages={data.pages} />
      </Panel>
    </main>
  );
}
