import 'server-only';
import { requirePlatformAdmin } from '@/modules/auth/authorization';
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
