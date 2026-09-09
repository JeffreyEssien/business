import { notFound } from 'next/navigation';
import { WorkspaceNavigation } from '@/components/catalog/workspace-navigation';
import { SearchEntryForm } from '@/components/seo/search-entry-form';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import type { SeoEntityType } from '@/modules/content/types';
import { getSeoEntryEditor } from '@/modules/seo/queries';

const entityTypes: Record<string, SeoEntityType> = {
  page: 'PAGE',
  product: 'PRODUCT',
  category: 'CATEGORY',
};

export const metadata = { title: 'Customize search wording' };

export default async function SearchEntryPage({
  params,
}: {
  params: Promise<{ slug: string; entityType: string; entityId: string }>;
}) {
  const { slug, entityType, entityId } = await params;
  const type = entityTypes[entityType];
  if (!type) notFound();
  const data = await getSeoEntryEditor(slug, type, entityId);
  return (
    <main className="tenant-home">
      <WorkspaceNavigation name={data.workspace.tenant.name} slug={slug} />
      <PageHeader
        eyebrow="HELP CUSTOMERS FIND THIS PAGE"
        title={data.record.name}
        description="Choose custom search and sharing wording for this page, or leave fields empty to keep using your store defaults. Saved changes stay private until you publish."
      />
      <Panel>
        <SearchEntryForm slug={slug} record={data.record} entry={data.entry ?? undefined} />
      </Panel>
    </main>
  );
}
