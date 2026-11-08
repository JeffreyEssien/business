import 'server-only';
import { sampleColumnToField, type EntryField, type EntryType } from './entries';
import { requirePortfolioWorkspace } from './guards';
import type { PortfolioEntry, PortfolioPart } from './types';

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
};

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

function toEntry(row: ItemRow): PortfolioEntry {
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
    exampleFields: exampleFieldsOf(row),
  };
}

const itemColumns =
  'id,item_type,title,subtitle,summary,role,outcome,link_url,source_url,starts_on,ends_on,is_current,tags,status,sample_content';

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
      .select('block_key,block_type,variant,is_enabled,content,sample_fields')
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
      .select('contact_email')
      .eq('tenant_id', tenantId)
      .single(),
  ]);
  if (blocks.error || items.error || business.error) {
    throw new Error('Your portfolio could not be loaded.');
  }
  const parts: PortfolioPart[] = (blocks.data ?? []).map((block) => ({
    key: block.block_key,
    type: block.block_type,
    variant: block.variant,
    enabled: block.is_enabled,
    content: (block.content ?? {}) as Record<string, unknown>,
    exampleFields: block.sample_fields ?? [],
  }));
  return {
    workspace,
    parts,
    entries: (items.data ?? []).map(toEntry),
    contactEmail: business.data.contact_email as string,
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
  return data ? toEntry(data) : null;
}
