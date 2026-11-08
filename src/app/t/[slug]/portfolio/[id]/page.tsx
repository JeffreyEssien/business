import { notFound } from 'next/navigation';
import { ConfirmButton } from '@/components/portfolio/confirm-button';
import { EntryForm } from '@/components/portfolio/entry-form';
import styles from '@/components/portfolio/builder.module.css';
import { ButtonLink } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { deleteEntry } from '@/modules/portfolio/actions';
import { getPortfolioEntry, hasUndoStep } from '@/modules/portfolio/builder-queries';
import { BuilderNotice } from '@/components/portfolio/builder-notice';
import { UndoButton } from '@/components/portfolio/undo-button';
import { entryCopy } from '@/modules/portfolio/entries';

export const metadata = { title: 'Edit entry' };
export default async function EditPortfolioEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { slug, id } = await params;
  const { notice } = await searchParams;
  const entry = await getPortfolioEntry(slug, id);
  if (!entry) notFound();
  const canUndo = await hasUndoStep(slug, 'entry', entry.id);
  const copy = entryCopy[entry.type];
  return (
    <main className="tenant-home">
      <PageHeader
        eyebrow="WORK & EXPERIENCE"
        title={`Edit ${copy.singular}`}
        description={entry.title}
        action={
          <ButtonLink variant="secondary" href={`/t/${slug}/portfolio?show=${copy.param}`}>
            ← Back
          </ButtonLink>
        }
      />
      <BuilderNotice notice={notice} />
      {canUndo && <UndoButton slug={slug} kind="entry" refKey={entry.id} />}
      <EntryForm slug={slug} type={entry.type} entry={entry} />
      <form
        className={styles.dangerZone}
        action={deleteEntry.bind(null, slug, entry.id, entry.type)}
      >
        <p>Delete this {copy.singular} from your portfolio. This cannot be undone.</p>
        <ConfirmButton label={`Delete ${copy.singular}`} confirmLabel="Yes, delete" />
      </form>
    </main>
  );
}
