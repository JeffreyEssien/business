import { DraftPreviewPanel } from '@/components/content/draft-preview-panel';
import { PublishSiteForm } from '@/components/content/publish-site-form';
import { SiteEditorForm } from '@/components/content/site-editor-form';
import { SectionOrderManager } from '@/components/content/section-order-manager';
import styles from '@/components/content/site-editor.module.css';
import { PortfolioDesignNotice } from '@/components/portfolio/portfolio-design-notice';
import { PageHeader } from '@/components/ui/page-header';
import { getSiteEditor } from '@/modules/content/queries';
import { portfolioSectionLanguage } from '@/modules/portfolio/sections';

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
    return (
      <main className="tenant-home">
        <PageHeader
          eyebrow="THEME & SECTIONS"
          title="Design your portfolio"
          description={`Preview saved changes without affecting visitors. When everything looks right, make the saved version visible.${published ? ` Published version ${published} is currently visible to visitors.` : ' Your portfolio has not been made visible yet.'}`}
          action={<PublishSiteForm slug={slug} audience="visitors" />}
        />
        <SectionOrderManager
          slug={slug}
          sections={editor.configuration.sections}
          saved={notice === 'order-saved'}
          language={portfolioSectionLanguage}
          audience="visitors"
        />
        <div className={styles.editorLayout}>
          <PortfolioDesignNotice sections={editor.configuration.sections} />
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
