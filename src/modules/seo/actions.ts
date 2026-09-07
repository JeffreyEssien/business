'use server';
import { revalidatePath } from 'next/cache';
import { getTenantWorkspace } from '@/modules/tenants/workspace-query';
import { validateGlobalSeo } from './validation';

export type SeoActionState = { error: string; message: string };
function canEdit(role: string) {
  return ['TENANT_OWNER', 'TENANT_ADMIN', 'TENANT_MANAGER'].includes(role);
}

export async function saveGlobalSeo(
  slug: string,
  _state: SeoActionState,
  form: FormData,
): Promise<SeoActionState> {
  const validation = validateGlobalSeo(form);
  if (!validation.input)
    return { error: validation.error ?? 'Check the search details.', message: '' };
  const workspace = await getTenantWorkspace(slug);
  if (!canEdit(workspace.membership.role))
    return {
      error: 'You do not have permission to change how this store appears in search.',
      message: '',
    };
  const { error } = await workspace.supabase.rpc('save_global_seo', {
    target_tenant: workspace.tenant.id,
    search_title: validation.input.title,
    search_title_template: `%s | ${validation.input.title}`,
    search_description: validation.input.description,
    social_account: validation.input.socialAccount,
    allow_search_listing: validation.input.allowSearchListing,
    allow_search_links: validation.input.allowSearchLinks,
    google_verification: '',
    bing_verification: '',
  });
  if (error) {
    return {
      error:
        error.code === '42501'
          ? 'You do not have permission to change these settings.'
          : 'Search appearance settings could not be saved. Check the fields and try again.',
      message: '',
    };
  }
  revalidatePath(`/t/${slug}/marketing/search`);
  return {
    error: '',
    message:
      'Search appearance saved for review. Customers and search engines will not see it until you publish.',
  };
}
