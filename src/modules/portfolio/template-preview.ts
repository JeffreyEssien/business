import type { SiteConfiguration } from '@/modules/content/types';
import type { LibraryTemplate } from './template-library';
import type { PublishedPortfolioEntry } from './types';

/**
 * A complete, read-only site configuration for a template's live preview, built from the
 * template library with its example content. Nothing here is stored or published.
 */
export function templatePreviewConfiguration(template: LibraryTemplate): SiteConfiguration {
  const portfolioItems: PublishedPortfolioEntry[] = template.items.map((item, index) => ({
    id: `${template.key}-${index}`,
    type: item.type as PublishedPortfolioEntry['type'],
    title: item.title,
    subtitle: item.subtitle ?? '',
    summary: item.summary ?? '',
    body: '',
    role: item.role ?? '',
    outcome: item.outcome ?? '',
    linkUrl: item.linkUrl ?? null,
    sourceUrl: item.sourceUrl ?? null,
    startsOn: item.startsOn ?? null,
    endsOn: item.endsOn ?? null,
    isCurrent: item.isCurrent ?? false,
    tags: item.tags ?? [],
    cover: null,
  }));
  return {
    siteKind: 'PORTFOLIO',
    portfolioItems,
    business: {
      name: template.preview.name,
      description: template.description,
      phone: '',
      address: '',
      contactEmail: 'hello@example.com',
      logo: null,
      heroMedia: null,
    },
    theme: { presetKey: template.defaultPreset, tokens: template.tokens },
    sections: template.sections.map((section) => ({
      key: section.key,
      type: section.type,
      variant: section.variant,
      enabled: true,
      content:
        section.type === 'hero'
          ? { ...section.content, headline: template.preview.name }
          : section.content,
      settings: {},
    })),
    pages: [],
    navigation: [],
  };
}
