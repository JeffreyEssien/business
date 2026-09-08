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
};

export type SearchContentRecord = {
  id: string;
  type: SeoEntityType;
  name: string;
  slug: string;
  description: string;
};

export async function getSeoWorkspace(slug: string) {
  const workspace = await getTenantWorkspace(slug);
  const tenantId = workspace.tenant.id;
  const [settings, pages, products, categories, entries] = await Promise.all([
    workspace.supabase
      .from('tenant_seo_settings')
      .select('site_title,description,twitter_handle,robots_index_enabled,robots_follow_enabled')
      .eq('tenant_id', tenantId)
      .single(),
    workspace.supabase
      .from('pages')
      .select('id,name,slug')
      .eq('tenant_id', tenantId)
      .neq('page_type', 'HOME')
      .order('name'),
    workspace.supabase
      .from('products')
      .select('id,name,slug,short_description')
      .eq('tenant_id', tenantId)
      .neq('status', 'ARCHIVED')
      .order('name'),
    workspace.supabase
      .from('categories')
      .select('id,name,slug,description')
      .eq('tenant_id', tenantId)
      .neq('status', 'ARCHIVED')
      .order('name'),
    workspace.supabase
      .from('seo_entries')
      .select(
        'entity_type,entity_id,seo_title,meta_description,canonical_url,social_title,social_description,robots_index,robots_follow',
      )
      .eq('tenant_id', tenantId),
  ]);
  if (settings.error || pages.error || products.error || categories.error || entries.error)
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
  return {
    workspace,
    settings: settings.data as GlobalSeoDraft,
    records,
    entries: (entries.data ?? []) as SeoEntryDraft[],
  };
}

export async function getSeoEntryEditor(slug: string, type: SeoEntityType, entityId: string) {
  const data = await getSeoWorkspace(slug);
  const record = data.records.find((item) => item.type === type && item.id === entityId);
  if (!record) notFound();
  const entry = data.entries.find(
    (item) => item.entity_type === type && item.entity_id === entityId,
  );
  return { ...data, record, entry };
}
