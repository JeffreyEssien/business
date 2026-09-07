import 'server-only';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getTenantWorkspace } from '@/modules/tenants/workspace-query';
import type { Category, Product, PublicStorefront } from './types';

export async function getCatalogWorkspace(slug: string) {
  const workspace = await getTenantWorkspace(slug);
  const { data: categories, error: categoryError } = await workspace.supabase
    .from('categories')
    .select('id,name,slug,description,status')
    .eq('tenant_id', workspace.tenant.id)
    .order('name');
  const { data: products, error: productError } = await workspace.supabase
    .from('products')
    .select(
      'id,name,slug,description,short_description,sku,price,compare_at_price,currency,stock_quantity,track_inventory,status,primary_image_asset_id',
    )
    .eq('tenant_id', workspace.tenant.id)
    .order('created_at', { ascending: false });
  if (categoryError || productError) throw new Error('Catalog could not be loaded.');
  return {
    ...workspace,
    categories: (categories ?? []) as Category[],
    products: (products ?? []) as Product[],
  };
}

export async function getProductEditor(slug: string, productId: string) {
  const catalog = await getCatalogWorkspace(slug);
  const product = catalog.products.find((item) => item.id === productId);
  if (!product) notFound();
  const [{ data: mappings, error: mappingError }, { data: asset, error: assetError }] =
    await Promise.all([
      catalog.supabase
        .from('product_categories')
        .select('category_id')
        .eq('tenant_id', catalog.tenant.id)
        .eq('product_id', productId),
      product.primary_image_asset_id
        ? catalog.supabase
            .from('media_assets')
            .select('public_url_or_resolvable_key,alt_text,resource_type')
            .eq('tenant_id', catalog.tenant.id)
            .eq('id', product.primary_image_asset_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
  if (mappingError || assetError) throw new Error('Product details could not be loaded.');
  return {
    ...catalog,
    product: {
      ...product,
      category_ids: (mappings ?? []).map((item) => item.category_id),
      media_url: asset?.public_url_or_resolvable_key,
      media_alt: asset?.alt_text,
      media_type: asset?.resource_type as 'image' | 'video' | undefined,
    },
  };
}

export const getPublicStorefront = cache(async function getPublicStorefront(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_public_storefront', { store_slug: slug });
  if (error) throw new Error('Storefront could not be loaded.');
  if (!data) notFound();
  return data as PublicStorefront;
});
