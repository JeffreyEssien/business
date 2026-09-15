import { PublishSiteForm } from '@/components/content/publish-site-form';
import { SiteEditorForm } from '@/components/content/site-editor-form';
import { SectionOrderManager } from '@/components/content/section-order-manager';
import styles from '@/components/content/site-editor.module.css';
import { PageHeader } from '@/components/ui/page-header';
import { getSiteEditor } from '@/modules/content/queries';

export const metadata = { title: 'Storefront design' };
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
  return (
    <main className="tenant-home">
      <PageHeader
        eyebrow="THEME & CONTENT"
        title="Design your storefront"
        description={`Edit and preview saved changes without affecting customers. When everything looks right, make the saved version visible on your store.${editor.publishedVersion ? ` Published version ${editor.publishedVersion} is currently visible to customers.` : ' Your store design has not been made visible to customers yet.'}`}
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
        <section className={styles.previewPanel} aria-label="Draft preview">
          <div className={styles.previewHeader}>
            <strong>Preview of saved changes</strong>
            <a href={`/t/${slug}/design/preview`} target="_blank">
              Open full preview ↗
            </a>
          </div>
          <iframe
            className={styles.previewFrame}
            title="Saved storefront draft preview"
            src={`/t/${slug}/design/preview`}
          />
        </section>
      </div>
    </main>
  );
}
