import { WorkspaceNavigation } from '@/components/catalog/workspace-navigation';
import { PublishSiteForm } from '@/components/content/publish-site-form';
import { SiteEditorForm } from '@/components/content/site-editor-form';
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
        description={`Edit the saved draft, preview the real renderer, then publish atomically.${editor.publishedVersion ? ` Version ${editor.publishedVersion} is live.` : ' Nothing has been published yet.'}`}
        action={<PublishSiteForm slug={slug} />}
      />
      <div className={styles.editorLayout}>
        <section className={styles.editorPanel} aria-label="Storefront settings">
          <SiteEditorForm slug={slug} configuration={editor.configuration} />
        </section>
        <section className={styles.previewPanel} aria-label="Draft preview">
          <div className={styles.previewHeader}>
            <strong>Saved draft preview</strong>
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
