/** Mirrors `tenants.site_kind`. The database is the authority; this is its TypeScript shape. */
export const siteKinds = ['STORE', 'PORTFOLIO'] as const;
export type SiteKind = (typeof siteKinds)[number];

export function isSiteKind(value: unknown): value is SiteKind {
  return typeof value === 'string' && (siteKinds as readonly string[]).includes(value);
}

/** Normalizes a stored value; anything missing or unexpected is the legacy STORE kind. */
export function siteKindOf(value: unknown): SiteKind {
  return isSiteKind(value) ? value : 'STORE';
}

/** A row from `public.site_templates` limited to what selection screens need. */
export type PortfolioTemplate = {
  key: string;
  name: string;
  description: string;
  audience: string;
  defaultTokens: {
    primary?: string;
    accent?: string;
    background?: string;
    text?: string;
    styleKey?: string;
  };
  sectionTypes: string[];
};

/** A homepage part as the builder edits it. `exampleFields` are still template examples. */
export type PortfolioPart = {
  key: string;
  type: string;
  variant: string;
  enabled: boolean;
  content: Record<string, unknown>;
  exampleFields: string[];
  /** The opening image (hero) or the part's own photo (About). */
  photo: PortfolioPhoto | null;
};

export type PortfolioPhoto = {
  url: string;
  alt: string;
  /** A template's bundled sample photo, which must be replaced before going live. */
  isSample?: boolean;
};

/** One photo in a project's album, as the builder edits it. */
export type AlbumPhoto = PortfolioPhoto & { id: string };

/** One portfolio entry as the builder edits it. */
export type PortfolioEntry = {
  id: string;
  type: import('./entries').EntryType;
  title: string;
  subtitle: string;
  summary: string;
  role: string;
  outcome: string;
  linkUrl: string;
  sourceUrl: string;
  startsOn: string;
  endsOn: string;
  isCurrent: boolean;
  tags: string[];
  hidden: boolean;
  cover: PortfolioPhoto | null;
  /** Project album, in display order. Loaded only where the album is edited. */
  gallery: AlbumPhoto[];
  /** Form fields that still hold the template's example value. */
  exampleFields: import('./entries').EntryField[];
};

/** A published entry as it appears in the public snapshot (`portfolioItems`). */
export type PublishedPortfolioEntry = {
  id: string;
  type: import('./entries').EntryType;
  title: string;
  subtitle: string;
  summary: string;
  body: string;
  role: string;
  outcome: string;
  linkUrl: string | null;
  sourceUrl: string | null;
  startsOn: string | null;
  endsOn: string | null;
  isCurrent: boolean;
  tags: string[];
  cover: { url: string; alt: string | null } | null;
  /** Project album photos, in the owner's order (absent in snapshots before albums). */
  gallery?: Array<{ url: string; alt: string | null }>;
};
