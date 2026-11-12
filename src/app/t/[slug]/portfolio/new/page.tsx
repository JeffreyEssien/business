import { EntryForm } from '@/components/portfolio/entry-form';
import { PageHeader } from '@/components/ui/page-header';
import { ButtonLink } from '@/components/ui/button';
import { entryCopy, entryTypeFromParam } from '@/modules/portfolio/entries';

export const metadata = { title: 'Add to your portfolio' };
export default async function NewPortfolioEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { slug } = await params;
  const type = entryTypeFromParam((await searchParams).type);
  const copy = entryCopy[type];
  return (
    <main className="tenant-home">
      <PageHeader
        eyebrow="WORK & EXPERIENCE"
        title={copy.addLabel}
        description={copy.emptyHint}
        action={
          <ButtonLink variant="secondary" href={`/t/${slug}/portfolio?show=${copy.param}`}>
            ← Back
          </ButtonLink>
        }
      />
      <EntryForm slug={slug} type={type} />
    </main>
  );
}
