import 'server-only';
import { getTenantWorkspace } from '@/modules/tenants/workspace-query';
import type { PublicProduct } from '@/modules/catalog/types';
import type { SiteConfiguration, SiteEditorData, SiteNavigationItem, SiteSection } from './types';

type BlockRow = {
  block_key: string;
  block_type: string;
  variant: string;
  is_enabled: boolean;
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
};

export async function getSiteEditor(
  slug: string,
): Promise<SiteEditorData & { workspace: Awaited<ReturnType<typeof getTenantWorkspace>> }> {
  const workspace = await getTenantWorkspace(slug);
  const tenantId = workspace.tenant.id;
  const pageResult = await workspace.supabase
    .from('pages')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('slug', 'home')
    .single();
  if (pageResult.error) throw new Error('Homepage could not be loaded.');
  const [businessResult, themeResult, blockResult, navigationResult, versionResult, productResult] =
    await Promise.all([
      workspace.supabase
        .from('tenant_business_settings')
        .select('business_name,description,phone,address,logo_asset_id,hero_asset_id')
        .eq('tenant_id', tenantId)
        .single(),
      workspace.supabase
        .from('tenant_theme_settings')
        .select('preset_key,tokens')
        .eq('tenant_id', tenantId)
        .single(),
      workspace.supabase
        .from('content_blocks')
        .select('block_key,block_type,variant,is_enabled,content,settings')
        .eq('tenant_id', tenantId)
        .eq('page_id', pageResult.data.id)
        .order('sort_order'),
      workspace.supabase
        .from('navigation_items')
        .select('label,target,location,link_type,is_enabled')
        .eq('tenant_id', tenantId)
        .order('sort_order'),
      workspace.supabase
        .from('tenant_site_versions')
        .select('version_number')
        .eq('tenant_id', tenantId)
        .eq('status', 'PUBLISHED')
        .maybeSingle(),
      workspace.supabase.rpc('get_public_storefront', { store_slug: slug }),
    ]);
  if (
    businessResult.error ||
    themeResult.error ||
    blockResult.error ||
    navigationResult.error ||
    versionResult.error ||
    productResult.error
  ) {
    throw new Error('Storefront editor data could not be loaded.');
  }
  const business = businessResult.data;
  const assetIds = [business.logo_asset_id, business.hero_asset_id].filter(Boolean) as string[];
  const assetResult = assetIds.length
    ? await workspace.supabase
        .from('media_assets')
        .select(
          'id,storage_provider,storage_key,resource_type,public_url_or_resolvable_key,alt_text',
        )
        .eq('tenant_id', tenantId)
        .in('id', assetIds)
    : { data: [], error: null };
  if (assetResult.error) throw new Error('Storefront media could not be loaded.');
  const assets = assetResult.data ?? [];
  const media = (id: string | null) => {
    const asset = assets.find((item) => item.id === id);
    return asset ? { url: asset.public_url_or_resolvable_key, alt: asset.alt_text } : null;
  };
  const sections = (blockResult.data ?? []).map((block: BlockRow) => ({
    key: block.block_key,
    type: block.block_type,
    variant: block.variant,
    enabled: block.is_enabled,
    content: block.content,
    settings: block.settings,
  })) as SiteSection[];
  const navigation = (navigationResult.data ?? []).map((item) => ({
    label: item.label,
    target: item.target,
    location: item.location,
    linkType: item.link_type,
    enabled: item.is_enabled,
  })) as SiteNavigationItem[];
  const configuration: SiteConfiguration = {
    business: {
      name: business.business_name,
      description: business.description,
      phone: business.phone,
      address: business.address,
      logo: media(business.logo_asset_id),
      heroMedia: media(business.hero_asset_id),
    },
    theme: {
      presetKey: themeResult.data.preset_key,
      tokens: themeResult.data.tokens as SiteConfiguration['theme']['tokens'],
    },
    sections,
    navigation,
  };
  const storefront = productResult.data as { products?: PublicProduct[] } | null;
  return {
    workspace,
    configuration,
    products: storefront?.products ?? [],
    publishedVersion: versionResult.data?.version_number ?? null,
    mediaRecords: assets.map((asset) => ({
      id: asset.id,
      storage_provider: asset.storage_provider,
      storage_key: asset.storage_key,
      resource_type: asset.resource_type as 'image' | 'video',
    })),
  };
}
