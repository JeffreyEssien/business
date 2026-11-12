import type { Metadata } from 'next';
import { TemplateGallery } from '@/components/portfolio/template-gallery';
import { activePortfolioTemplateKeys } from '@/modules/portfolio/queries';
import { portfolioTemplateLibrary } from '@/modules/portfolio/template-library';

export const metadata: Metadata = {
  title: 'Portfolio templates',
  description:
    'Twenty-four portfolio templates for developers, designers, photographers, writers, and more.',
};

export default async function TemplatesPage() {
  // Only templates Super Admin offers are listed. If the database is unreachable the
  // full library is shown: it is public marketing content with nothing tenant-specific.
  const active = await activePortfolioTemplateKeys();
  const templates = active
    ? portfolioTemplateLibrary.filter((template) => active.includes(template.key))
    : portfolioTemplateLibrary;
  return <TemplateGallery templates={templates} />;
}
