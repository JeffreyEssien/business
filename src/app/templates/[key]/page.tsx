import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import styles from '@/components/portfolio/template-gallery.module.css';
import { StorefrontRenderer } from '@/components/storefront/storefront-renderer';
import { activePortfolioTemplateKeys } from '@/modules/portfolio/queries';
import { libraryTemplate } from '@/modules/portfolio/template-library';
import { templatePreviewConfiguration } from '@/modules/portfolio/template-preview';

type Params = { params: Promise<{ key: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const template = libraryTemplate((await params).key);
  return {
    title: template ? `${template.name} portfolio template` : 'Template',
    // Previews are full of example content; keep them out of search results.
    robots: { index: false, follow: true },
  };
}

export default async function TemplatePreviewPage({ params }: Params) {
  const { key } = await params;
  const template = libraryTemplate(key);
  const active = await activePortfolioTemplateKeys();
  if (!template || (active && !active.includes(template.key))) notFound();
  return (
    <>
      <div className={styles.previewBar}>
        <Link href="/templates">← All templates</Link>
        <p>
          {template.name} · {template.audience} · Example content
        </p>
      </div>
      <StorefrontRenderer
        slug="preview"
        configuration={templatePreviewConfiguration(template)}
        products={[]}
      />
    </>
  );
}
