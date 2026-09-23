import { notFound } from 'next/navigation';
import { ContentPageForm } from '@/components/content/content-page-form';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { getContentPagesWorkspace } from '@/modules/content/queries';

export const metadata = { title: 'Edit website page' };
export default async function EditWebsitePage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const data = await getContentPagesWorkspace(slug);
  const page = data.pages.find((item) => item.id === id);
  if (!page) notFound();
  return (
    <main className="tenant-home">
      <PageHeader
        eyebrow="EDIT CUSTOMER PAGE"
        title={page.name}
        description="Update the saved page without changing what customers currently see. Publish from Store design when it is ready."
      />
      <Panel>
        <ContentPageForm slug={slug} page={page} />
      </Panel>
    </main>
  );
}
