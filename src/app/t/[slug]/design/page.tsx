import { DraftPreviewPanel } from '@/components/content/draft-preview-panel';
import { PublishSiteForm } from '@/components/content/publish-site-form';
import { SiteEditorForm } from '@/components/content/site-editor-form';
import { SectionOrderManager } from '@/components/content/section-order-manager';
import styles from '@/components/content/site-editor.module.css';
import { AddPartMenu } from '@/components/portfolio/add-part-menu';
import { BuilderNotice } from '@/components/portfolio/builder-notice';
import { ConfirmButton } from '@/components/portfolio/confirm-button';
import builderStyles from '@/components/portfolio/builder.module.css';
import { PageHeader } from '@/components/ui/page-header';
import { ButtonLink } from '@/components/ui/button';
import { getSiteEditor } from '@/modules/content/queries';
import { getPortfolioBuilder } from '@/modules/portfolio/builder-queries';
import { partEntryType } from '@/modules/portfolio/entries';
import { portfolioSectionLanguage } from '@/modules/portfolio/sections';
import { takePortfolioOffline } from '@/modules/portfolio/actions';

export const metadata = { title: 'Website design' };
export default async function StorefrontDesignPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { slug } = await params;
  const { notice } = await searchParams;
  const editor = await getSiteEditor(slug);
  const published = editor.publishedVersion;

  // Portfolios never render the store form: its save writes store-only sections.
  if (editor.configuration.siteKind === 'PORTFOLIO') {
    const { parts, entries } = await getPortfolioBuilder(slug);
    const badges = Object.fromEntries(
      parts.map((part) => {
        const entryType = partEntryType[part.type];
        const exampleEntries = entryType
          ? entries.filter(
              (entry) => entry.type === entryType && !entry.hidden && entry.exampleFields.length,
            )
          : [];
        return [
          part.key,
          [
            ...(part.exampleFields.length ? ['Example text'] : []),
            ...(exampleEntries.length
              ? [
                  `${exampleEntries.length} example ${exampleEntries.length === 1 ? 'entry' : 'entries'}`,
                ]
              : []),
            ...(!part.enabled ? ['Hidden'] : []),
          ],
        ];
      }),
    );
    return (
      <main className="tenant-home">
        <PageHeader
          eyebrow="YOUR PAGE"
          title="Design your portfolio"
          description={`Edit each part of your page, put them in order, and preview the result. Visitors only see changes after you make your portfolio live.${published ? ` Version ${published} is live now.` : ' Your portfolio is not live yet.'}`}
          action={<PublishSiteForm slug={slug} audience="visitors" />}
        />
        {/* "Offline" stops being true as soon as it is live again (same address, new state). */}
        <BuilderNotice notice={notice === 'offline' && published ? undefined : notice} />
        <div className={builderStyles.pageActions}>
          <ButtonLink variant="secondary" href={`/t/${slug}/design/look`}>
            Change colours &amp; look
          </ButtonLink>
          {published && (
            <form action={takePortfolioOffline.bind(null, slug)}>
              <ConfirmButton
                label="Take portfolio offline"
                confirmLabel="Yes, take it offline"
                question="Visitors will see a “not live yet” page until you make it live again."
              />
            </form>
          )}
        </div>
        <SectionOrderManager
          slug={slug}
          sections={editor.configuration.sections}
          saved={notice === 'order-saved'}
          language={portfolioSectionLanguage}
          audience="visitors"
          editHrefBase={`/t/${slug}/design/parts`}
          badges={badges}
        />
        <div className={styles.editorLayout}>
          <section className={styles.editorPanel} aria-label="Add to your page">
            <AddPartMenu slug={slug} />
          </section>
          <DraftPreviewPanel slug={slug} label="portfolio" />
        </div>
      </main>
    );
  }

  return (
    <main className="tenant-home">
      <PageHeader
        eyebrow="THEME & CONTENT"
        title="Design your storefront"
        description={`Edit and preview saved changes without affecting customers. When everything looks right, make the saved version visible on your store.${published ? ` Published version ${published} is currently visible to customers.` : ' Your store design has not been made visible to customers yet.'}`}
        action={<PublishSiteForm slug={slug} />}
      />
      <SectionOrderManager
        slug={slug}
        sections={editor.configuration.sections}
        saved={notice === 'order-saved'}
      />
      <div className={styles.editorLayout}>
        <section className={styles.editorPanel} aria-label="Storefront settings">
          <SiteEditorForm
            slug={slug}
            configuration={editor.configuration}
            saved={notice === 'saved'}
          />
        </section>
        <DraftPreviewPanel slug={slug} label="storefront" />
      </div>
    </main>
  );
}
