import 'server-only';
import { sampleColumnToField, type EntryField, type EntryType } from './entries';
import { requirePortfolioWorkspace } from './guards';
import type { PortfolioEntry, PortfolioPart, PortfolioPhoto } from './types';

type ItemRow = {
  id: string;
  item_type: EntryType;
  title: string;
  subtitle: string;
  summary: string;
  role: string;
  outcome: string;
  link_url: string | null;
  source_url: string | null;
  starts_on: string | null;
  ends_on: string | null;
  is_current: boolean;
  tags: string[];
  status: 'ACTIVE' | 'HIDDEN';
  sample_content: Record<string, unknown>;
  cover_asset_id: string | null;
};

type AssetRow = { id: string; public_url_or_resolvable_key: string; alt_text: string | null };

function photoOf(assets: AssetRow[], id: string | null | undefined): PortfolioPhoto | null {
  const asset = id ? assets.find((item) => item.id === id) : undefined;
  return asset ? { url: asset.public_url_or_resolvable_key, alt: asset.alt_text ?? '' } : null;
}

/** About photos are stored on the part itself (settings.photo) by set_portfolio_photo. */
function settingsPhoto(settings: unknown): PortfolioPhoto | null {
  const photo = (settings as { photo?: { url?: unknown; alt?: unknown } } | null)?.photo;
  return photo && typeof photo.url === 'string'
    ? { url: photo.url, alt: typeof photo.alt === 'string' ? photo.alt : '' }
    : null;
}

/** Mirrors private.unedited_sample_fields: equal to the example value and not empty. */
function exampleFieldsOf(row: ItemRow): EntryField[] {
  const current = row as unknown as Record<string, unknown>;
  return Object.entries(row.sample_content ?? {})
    .filter(([column, sample]) => {
      const empty = sample === '' || sample === null || (Array.isArray(sample) && !sample.length);
      return !empty && JSON.stringify(current[column]) === JSON.stringify(sample);
    })
    .map(([column]) => sampleColumnToField[column])
    .filter((field): field is EntryField => Boolean(field));
}

function toEntry(row: ItemRow, assets: AssetRow[] = []): PortfolioEntry {
  return {
    id: row.id,
    type: row.item_type,
    title: row.title,
    subtitle: row.subtitle,
    summary: row.summary,
    role: row.role,
    outcome: row.outcome,
    linkUrl: row.link_url ?? '',
    sourceUrl: row.source_url ?? '',
    startsOn: row.starts_on ?? '',
    endsOn: row.ends_on ?? '',
    isCurrent: row.is_current,
    tags: row.tags ?? [],
    hidden: row.status === 'HIDDEN',
    cover: photoOf(assets, row.cover_asset_id),
    exampleFields: exampleFieldsOf(row),
  };
}

const itemColumns =
  'id,item_type,title,subtitle,summary,role,outcome,link_url,source_url,starts_on,ends_on,is_current,tags,status,sample_content,cover_asset_id';

async function loadAssets(
  supabase: Awaited<ReturnType<typeof requirePortfolioWorkspace>>['supabase'],
  tenantId: string,
  ids: Array<string | null | undefined>,
) {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!wanted.length) return [];
  const { data, error } = await supabase
    .from('media_assets')
    .select('id,public_url_or_resolvable_key,alt_text')
    .eq('tenant_id', tenantId)
    .in('id', wanted)
    .returns<AssetRow[]>();
  if (error) throw new Error('Your photos could not be loaded.');
  return data ?? [];
}

/** Homepage parts and every entry, loaded together in one authorized operation. */
export async function getPortfolioBuilder(slug: string) {
  const workspace = await requirePortfolioWorkspace(slug);
  const tenantId = workspace.tenant.id;
  const page = await workspace.supabase
    .from('pages')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('page_type', 'HOME')
    .single();
  if (page.error) throw new Error('Your portfolio could not be loaded.');
  const [blocks, items, business] = await Promise.all([
    workspace.supabase
      .from('content_blocks')
      .select('block_key,block_type,variant,is_enabled,content,settings,sample_fields')
      .eq('tenant_id', tenantId)
      .eq('page_id', page.data.id)
      .order('sort_order'),
    workspace.supabase
      .from('portfolio_items')
      .select(itemColumns)
      .eq('tenant_id', tenantId)
      .order('item_type')
      .order('sort_order')
      .returns<ItemRow[]>(),
    workspace.supabase
      .from('tenant_business_settings')
      .select('contact_email,whatsapp,business_name,hero_asset_id')
      .eq('tenant_id', tenantId)
      .single(),
  ]);
  if (blocks.error || items.error || business.error) {
    throw new Error('Your portfolio could not be loaded.');
  }
  const itemRows = items.data ?? [];
  const assets = await loadAssets(workspace.supabase, tenantId, [
    business.data.hero_asset_id,
    ...itemRows.map((row) => row.cover_asset_id),
  ]);
  const parts: PortfolioPart[] = (blocks.data ?? []).map((block) => ({
    key: block.block_key,
    type: block.block_type,
    variant: block.variant,
    enabled: block.is_enabled,
    content: (block.content ?? {}) as Record<string, unknown>,
    exampleFields: block.sample_fields ?? [],
    photo:
      block.block_type === 'hero'
        ? photoOf(assets, business.data.hero_asset_id)
        : settingsPhoto(block.settings),
  }));
  return {
    workspace,
    parts,
    entries: itemRows.map((row) => toEntry(row, assets)),
    contactEmail: business.data.contact_email as string,
    whatsapp: (business.data.whatsapp as string | null) ?? '',
    displayName: business.data.business_name as string,
  };
}

/** One entry, or null when it does not belong to this portfolio. */
export async function getPortfolioEntry(slug: string, id: string) {
  const workspace = await requirePortfolioWorkspace(slug);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await workspace.supabase
    .from('portfolio_items')
    .select(itemColumns)
    .eq('tenant_id', workspace.tenant.id)
    .eq('id', id)
    .maybeSingle<ItemRow>();
  if (error) throw new Error('This entry could not be loaded.');
  if (!data) return null;
  const assets = await loadAssets(workspace.supabase, workspace.tenant.id, [data.cover_asset_id]);
  return toEntry(data, assets);
}

/** Whether "Undo last change" has anything to restore for one part or entry. */
export async function hasUndoStep(slug: string, kind: 'part' | 'entry', ref: string) {
  const workspace = await requirePortfolioWorkspace(slug);
  const { count, error } = await workspace.supabase
    .from('portfolio_revisions')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', workspace.tenant.id)
    .eq('target_kind', kind)
    .eq('target_ref', ref);
  if (error) return false;
  return (count ?? 0) > 0;
}
