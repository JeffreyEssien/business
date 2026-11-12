import { notFound } from 'next/navigation';
import { BuilderNotice } from '@/components/portfolio/builder-notice';
import { ConfirmButton } from '@/components/portfolio/confirm-button';
import { PartForm } from '@/components/portfolio/part-form';
import styles from '@/components/portfolio/builder.module.css';
import { ButtonLink } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { removePart } from '@/modules/portfolio/actions';
import { getPortfolioBuilder, hasUndoStep } from '@/modules/portfolio/builder-queries';
import { UndoButton } from '@/components/portfolio/undo-button';
import { portfolioSectionLanguage } from '@/modules/portfolio/sections';

export const metadata = { title: 'Edit part of your page' };
export default async function EditPortfolioPartPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; key: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { slug, key } = await params;
  const { notice } = await searchParams;
  const { parts } = await getPortfolioBuilder(slug);
  const part = parts.find((candidate) => candidate.key === decodeURIComponent(key));
  if (!part) notFound();
  const name = portfolioSectionLanguage[part.type]?.name ?? 'Part of your page';
  const canUndo = await hasUndoStep(slug, 'part', part.key);
  // The main button can jump to any other visible part of the page.
  const destinations = parts
    .filter((candidate) => candidate.type !== 'hero' && candidate.enabled)
    .map((candidate) => {
      const heading = candidate.content.heading;
      return {
        value: `#${candidate.key}`,
        label:
          typeof heading === 'string' && heading
            ? heading
            : (portfolioSectionLanguage[candidate.type]?.name ?? candidate.key),
      };
    });
  return (
    <main className="tenant-home">
      <PageHeader
        eyebrow="YOUR PAGE"
        title={`Edit: ${name}`}
        description={portfolioSectionLanguage[part.type]?.description ?? ''}
        action={
          <ButtonLink variant="secondary" href={`/t/${slug}/design`}>
            ← Back to your page
          </ButtonLink>
        }
      />
      <BuilderNotice notice={notice} />
      {canUndo && <UndoButton slug={slug} kind="part" refKey={part.key} />}
      <PartForm slug={slug} part={part} partName={name} destinations={destinations} />
      {part.type !== 'hero' && (
        <form className={styles.dangerZone} action={removePart.bind(null, slug, part.key)}>
          <p>
            Remove this part from your page. Your {name.toLowerCase()} entries are kept and can be
            shown again by adding the part back.
          </p>
          <ConfirmButton label="Remove this part" confirmLabel="Yes, remove" />
        </form>
      )}
    </main>
  );
}
