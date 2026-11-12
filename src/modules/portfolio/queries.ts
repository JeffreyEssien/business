import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { requirePlatformAdmin } from '@/modules/auth/authorization';
import { libraryTemplate } from './template-library';
import type { PortfolioTemplate } from './types';

type TemplateRow = {
  key: string;
  name: string;
  description: string;
  audience: string;
  default_tokens: PortfolioTemplate['defaultTokens'] | null;
  default_sections: Array<{ type?: unknown }> | null;
};

/** Active portfolio templates in catalog order, for Super Admin provisioning screens. */
export async function listPortfolioTemplates(): Promise<PortfolioTemplate[]> {
  const { supabase } = await requirePlatformAdmin();
  const { data, error } = await supabase
    .from('site_templates')
    .select('key,name,description,audience,default_tokens,default_sections')
    .eq('site_kind', 'PORTFOLIO')
    .eq('is_active', true)
    .order('sort_order')
    .returns<TemplateRow[]>();
  if (error) throw new Error('Portfolio templates could not be loaded.');
  return (data ?? []).map((row) => ({
    key: row.key,
    name: row.name,
    description: row.description,
    audience: row.audience,
    defaultTokens: row.default_tokens ?? {},
    sectionTypes: (row.default_sections ?? [])
      .map((section) => section.type)
      .filter((type): type is string => typeof type === 'string'),
  }));
}

/**
 * Template keys Super Admin currently offers, for the public gallery. Returns null when
 * the database cannot be reached so the caller can decide how to degrade.
 */
export async function activePortfolioTemplateKeys(): Promise<string[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('list_active_portfolio_templates');
  if (error || !Array.isArray(data)) return null;
  return data.filter((key): key is string => typeof key === 'string');
}

/** Template on/off for Super Admin, with how many portfolios use each template. */
export async function getTemplateAdministration() {
  const { supabase } = await requirePlatformAdmin();
  const [templates, tenants] = await Promise.all([
    supabase
      .from('site_templates')
      .select('key,is_active')
      .eq('site_kind', 'PORTFOLIO')
      .returns<Array<{ key: string; is_active: boolean }>>(),
    supabase
      .from('tenants')
      .select('template_key')
      .eq('site_kind', 'PORTFOLIO')
      .returns<Array<{ template_key: string | null }>>(),
  ]);
  if (templates.error || tenants.error) throw new Error('Templates could not be loaded.');
  const usage = new Map<string, number>();
  for (const row of tenants.data ?? [])
    if (row.template_key) usage.set(row.template_key, (usage.get(row.template_key) ?? 0) + 1);
  return (templates.data ?? []).map((row) => ({
    key: row.key,
    active: row.is_active,
    portfolios: usage.get(row.key) ?? 0,
  }));
}

/**
 * Template styles of the templates Super Admin currently offers, for the owner's look
 * pickers. Null when the list cannot be read (pickers then show every look).
 */
export async function activePortfolioStyles(): Promise<string[] | null> {
  const keys = await activePortfolioTemplateKeys();
  if (!keys) return null;
  return keys
    .map((key) => libraryTemplate(key)?.tokens.templateStyle)
    .filter((style): style is string => Boolean(style));
}
