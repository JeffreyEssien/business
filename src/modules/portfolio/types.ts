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
