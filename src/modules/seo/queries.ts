import 'server-only';
import { getTenantWorkspace } from '@/modules/tenants/workspace-query';

export type GlobalSeoDraft = {
  site_title: string;
  description: string;
  twitter_handle: string;
  robots_index_enabled: boolean;
  robots_follow_enabled: boolean;
};

export async function getSeoWorkspace(slug: string) {
  const workspace = await getTenantWorkspace(slug);
  const { data, error } = await workspace.supabase
    .from('tenant_seo_settings')
    .select('site_title,description,twitter_handle,robots_index_enabled,robots_follow_enabled')
    .eq('tenant_id', workspace.tenant.id)
    .single();
  if (error) throw new Error('Search appearance settings could not be loaded.');
  return { workspace, settings: data as GlobalSeoDraft };
}
