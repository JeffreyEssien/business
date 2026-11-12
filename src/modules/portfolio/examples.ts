import { entryCopy, isEntryType, partFieldNames } from './entries';
import { portfolioSectionLanguage } from './sections';

export type RemainingExample = { label: string; href: string };

type DetailRow = {
  kind?: string;
  key?: string;
  id?: string;
  type?: string;
  label?: string;
  /** Sample photos: which photo slot still shows a template picture. */
  slot?: 'hero' | 'about' | 'cover' | 'album';
  fields?: string[];
};

/**
 * Turns the database's STARTER_CONTENT_PRESENT detail into plain sentences that link
 * straight to the field or entry to fix. Unknown rows are skipped rather than shown raw.
 */
export function describeRemainingExamples(slug: string, detail: string | undefined) {
  let rows: DetailRow[] = [];
  try {
    const parsed = JSON.parse(detail ?? '[]');
    rows = Array.isArray(parsed) ? parsed : [];
  } catch {
    rows = [];
  }
  const remaining: RemainingExample[] = [];
  for (const row of rows) {
    if (row.kind === 'section' && row.key) {
      const part = portfolioSectionLanguage[row.type ?? '']?.name ?? 'A part of your page';
      const fields = (row.fields ?? []).map((field) => partFieldNames[field] ?? field);
      remaining.push({
        label: `${part}: replace the ${fields.join(' and ') || 'example text'}`,
        href: `/t/${slug}/design/parts/${encodeURIComponent(row.key)}`,
      });
    } else if (row.kind === 'item' && row.id && isEntryType(row.type)) {
      remaining.push({
        label: `Example ${entryCopy[row.type].singular}: “${row.label ?? ''}”`,
        href: `/t/${slug}/portfolio/${row.id}`,
      });
    } else if (row.kind === 'photo' && (row.slot === 'hero' || row.slot === 'about') && row.key) {
      remaining.push({
        label:
          row.slot === 'hero'
            ? 'Introduction: choose your own big picture'
            : 'About: choose your own photo',
        href: `/t/${slug}/design/parts/${encodeURIComponent(row.key)}`,
      });
    } else if (row.kind === 'photo' && row.id && isEntryType(row.type)) {
      const what = row.slot === 'album' ? 'album photos' : 'main photo';
      remaining.push({
        label: `“${row.label ?? entryCopy[row.type].singular}”: replace the sample ${what}`,
        href: `/t/${slug}/portfolio/${row.id}`,
      });
    }
  }
  return remaining;
}
