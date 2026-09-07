import { WorkspaceNavigation } from '@/components/catalog/workspace-navigation';
import { ContentPageForm } from '@/components/content/content-page-form';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { getTenantWorkspace } from '@/modules/tenants/workspace-query';

export const metadata = { title: 'Create a website page' };
export default async function NewWebsitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant } = await getTenantWorkspace(slug);
  return (
    <main className="tenant-home">
      <WorkspaceNavigation name={tenant.name} slug={slug} />
      <PageHeader
        eyebrow="NEW CUSTOMER PAGE"
        title="What should customers know?"
        description="Add an About page, contact details, a store policy, or any other useful information. You can review everything before customers see it."
      />
      <Panel>
        <ContentPageForm slug={slug} />
      </Panel>
    </main>
  );
}
