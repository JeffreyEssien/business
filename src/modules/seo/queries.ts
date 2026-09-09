import 'server-only';
import { notFound } from 'next/navigation';
import { getTenantWorkspace } from '@/modules/tenants/workspace-query';
import type { SeoEntityType } from '@/modules/content/types';

export type GlobalSeoDraft = {
  site_title: string;
  description: string;
  twitter_handle: string;
  robots_index_enabled: boolean;
  robots_follow_enabled: boolean;
  social_asset_id: string | null;
  social_image_url: string | null;
};

export type SeoEntryDraft = {
  entity_type: SeoEntityType;
  entity_id: string;
  seo_title: string;
  meta_description: string;
  canonical_url: string | null;
  social_title: string;
  social_description: string;
  robots_index: boolean;
  robots_follow: boolean;
  social_asset_id: string | null;
  social_image_url: string | null;
};

export type SearchContentRecord = {
  id: string;
  type: SeoEntityType;
  name: string;
  slug: string;
  description: string;
};

export const SEO_PRODUCT_PAGE_SIZE = 20;

export async function getSeoWorkspace(slug: string, productSearch = '', productPage = 1) {
  const workspace = await getTenantWorkspace(slug);
  const tenantId = workspace.tenant.id;
  const page = Math.max(productPage, 1);
  const search = productSearch
    .replace(/[%_\\]/g, '')
    .trim()
    .slice(0, 100);
  let productQuery = workspace.supabase
    .from('products')
    .select('id,name,slug,short_description', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .neq('status', 'ARCHIVED')
    .order('name')
    .order('id');
  if (search) productQuery = productQuery.ilike('name', `%${search}%`);
  const [settings, pages, products, categories] = await Promise.all([
    workspace.supabase
      .from('tenant_seo_settings')
      .select(
        'site_title,description,twitter_handle,robots_index_enabled,robots_follow_enabled,social_asset_id',
      )
      .eq('tenant_id', tenantId)
      .single(),
    workspace.supabase
      .from('pages')
      .select('id,name,slug')
      .eq('tenant_id', tenantId)
      .neq('page_type', 'HOME')
      .order('name')
      .limit(200),
    productQuery.range((page - 1) * SEO_PRODUCT_PAGE_SIZE, page * SEO_PRODUCT_PAGE_SIZE - 1),
    workspace.supabase
      .from('categories')
      .select('id,name,slug,description')
      .eq('tenant_id', tenantId)
      .neq('status', 'ARCHIVED')
      .order('name')
      .limit(200),
  ]);
  if (settings.error || pages.error || products.error || categories.error)
    throw new Error('Search appearance settings could not be loaded.');
  const records: SearchContentRecord[] = [
    ...(pages.data ?? []).map((item) => ({
      id: item.id,
      type: 'PAGE' as const,
      name: item.name,
      slug: item.slug,
      description: 'Customer information page',
    })),
    ...(products.data ?? []).map((item) => ({
      id: item.id,
      type: 'PRODUCT' as const,
      name: item.name,
      slug: item.slug,
      description: item.short_description || 'Product page',
    })),
    ...(categories.data ?? []).map((item) => ({
      id: item.id,
      type: 'CATEGORY' as const,
      name: item.name,
      slug: item.slug,
      description: item.description || 'Product collection page',
    })),
  ];
  const ids = records.map((record) => record.id);
  const entries = ids.length
    ? await workspace.supabase
        .from('seo_entries')
        .select(
          'entity_type,entity_id,seo_title,meta_description,canonical_url,social_title,social_description,robots_index,robots_follow,social_asset_id',
        )
        .eq('tenant_id', tenantId)
        .in('entity_id', ids)
    : { data: [], error: null };
  if (entries.error) throw new Error('Saved search wording could not be loaded.');
  const assetIds = [
    settings.data.social_asset_id,
    ...(entries.data ?? []).map((entry) => entry.social_asset_id),
  ].filter((id): id is string => Boolean(id));
  const assets = assetIds.length
    ? await workspace.supabase
        .from('media_assets')
        .select('id,public_url_or_resolvable_key')
        .eq('tenant_id', tenantId)
        .in('id', assetIds)
    : { data: [], error: null };
  if (assets.error) throw new Error('Sharing images could not be loaded.');
  const imageUrl = (id: string | null) =>
    id
      ? ((assets.data ?? []).find((asset) => asset.id === id)?.public_url_or_resolvable_key ?? null)
      : null;
  return {
    workspace,
    settings: {
      ...settings.data,
      social_image_url: imageUrl(settings.data.social_asset_id),
    } as GlobalSeoDraft,
    records,
    entries: (entries.data ?? []).map((entry) => ({
      ...entry,
      social_image_url: imageUrl(entry.social_asset_id),
    })) as SeoEntryDraft[],
    productTotal: products.count ?? 0,
    productPage: page,
    productSearch: search,
  };
}

export async function getSeoEntryEditor(slug: string, type: SeoEntityType, entityId: string) {
  const workspace = await getTenantWorkspace(slug);
  const source =
    type === 'PAGE'
      ? workspace.supabase
          .from('pages')
          .select('id,name,slug')
          .eq('tenant_id', workspace.tenant.id)
          .eq('id', entityId)
          .neq('page_type', 'HOME')
          .maybeSingle()
      : type === 'PRODUCT'
        ? workspace.supabase
            .from('products')
            .select('id,name,slug,short_description')
            .eq('tenant_id', workspace.tenant.id)
            .eq('id', entityId)
            .neq('status', 'ARCHIVED')
            .maybeSingle()
        : workspace.supabase
            .from('categories')
            .select('id,name,slug,description')
            .eq('tenant_id', workspace.tenant.id)
            .eq('id', entityId)
            .neq('status', 'ARCHIVED')
            .maybeSingle();
  const [sourceResult, entryResult] = await Promise.all([
    source,
    workspace.supabase
      .from('seo_entries')
      .select(
        'entity_type,entity_id,seo_title,meta_description,canonical_url,social_title,social_description,robots_index,robots_follow,social_asset_id',
      )
      .eq('tenant_id', workspace.tenant.id)
      .eq('entity_type', type)
      .eq('entity_id', entityId)
      .maybeSingle(),
  ]);
  if (sourceResult.error || entryResult.error)
    throw new Error('Search appearance could not be loaded.');
  if (!sourceResult.data) notFound();
  const sourceRecord = sourceResult.data as {
    id: string;
    name: string;
    slug: string;
    short_description?: string;
    description?: string;
  };
  const record: SearchContentRecord = {
    id: sourceRecord.id,
    type,
    name: sourceRecord.name,
    slug: sourceRecord.slug,
    description:
      sourceRecord.short_description ||
      sourceRecord.description ||
      (type === 'PAGE' ? 'Customer information page' : `${type.toLowerCase()} page`),
  };
  let entry = entryResult.data as Omit<SeoEntryDraft, 'social_image_url'> | null;
  let socialImageUrl: string | null = null;
  if (entry?.social_asset_id) {
    const imageResult = await workspace.supabase
      .from('media_assets')
      .select('public_url_or_resolvable_key')
      .eq('tenant_id', workspace.tenant.id)
      .eq('id', entry.social_asset_id)
      .maybeSingle();
    if (imageResult.error) throw new Error('Sharing image could not be loaded.');
    socialImageUrl = imageResult.data?.public_url_or_resolvable_key ?? null;
  }
  return {
    workspace,
    record,
    entry: entry ? { ...entry, social_image_url: socialImageUrl } : null,
  };
}
