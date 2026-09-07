import { WorkspaceNavigation } from '@/components/catalog/workspace-navigation';
import { PublishSiteForm } from '@/components/content/publish-site-form';
import { SiteEditorForm } from '@/components/content/site-editor-form';
import { SectionOrderManager } from '@/components/content/section-order-manager';
import styles from '@/components/content/site-editor.module.css';
import { PageHeader } from '@/components/ui/page-header';
import { getSiteEditor } from '@/modules/content/queries';

export const metadata = { title: 'Storefront design' };
export default async function StorefrontDesignPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const editor = await getSiteEditor(slug);
  return (
    <main className="tenant-home">
      <WorkspaceNavigation name={editor.workspace.tenant.name} slug={slug} />
      <PageHeader
        eyebrow="THEME & CONTENT"
        title="Design your storefront"
        description={`Edit and preview saved changes without affecting customers. When everything looks right, make the saved version visible on your store.${editor.publishedVersion ? ` Published version ${editor.publishedVersion} is currently visible to customers.` : ' Your store design has not been made visible to customers yet.'}`}
        action={<PublishSiteForm slug={slug} />}
      />
      <SectionOrderManager slug={slug} sections={editor.configuration.sections} />
      <div className={styles.editorLayout}>
        <section className={styles.editorPanel} aria-label="Storefront settings">
          <SiteEditorForm slug={slug} configuration={editor.configuration} />
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
