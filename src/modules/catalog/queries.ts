import 'server-only';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getTenantWorkspace } from '@/modules/tenants/workspace-query';
import { recordServerOperation } from '@/lib/observability/server';
import type {
  Category,
  Product,
  PublicProductPage,
  PublicProductResult,
  PublicStorefront,
} from './types';

export const CATALOG_PAGE_SIZE = 20;

export async function getCategoryWorkspace(slug: string) {
  const workspace = await getTenantWorkspace(slug);
  const { data, error } = await workspace.supabase
    .from('categories')
    .select('id,name,slug,description,status')
    .eq('tenant_id', workspace.tenant.id)
    .order('name')
    .limit(200);
  if (error) throw new Error('Product collections could not be loaded.');
  return { ...workspace, categories: (data ?? []) as Category[] };
}

export async function getCatalogWorkspace(
  slug: string,
  filters: { page?: number; search?: string; status?: string } = {},
) {
  const startedAt = performance.now();
  const workspace = await getTenantWorkspace(slug);
  const page = Math.max(1, filters.page ?? 1);
  const search = (filters.search ?? '')
    .replace(/[%_\\]/g, '')
    .trim()
    .slice(0, 100);
  const status = ['DRAFT', 'ACTIVE', 'ARCHIVED'].includes(filters.status ?? '')
    ? filters.status
    : '';
  let productQuery = workspace.supabase
    .from('products')
    .select(
      'id,name,slug,description,short_description,sku,price,compare_at_price,currency,stock_quantity,track_inventory,status,primary_image_asset_id',
      { count: 'exact' },
    )
    .eq('tenant_id', workspace.tenant.id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });
  if (search) productQuery = productQuery.ilike('name', `%${search}%`);
  if (status) productQuery = productQuery.eq('status', status);
  const [categoryResult, productResult, activeCount] = await Promise.all([
    workspace.supabase
      .from('categories')
      .select('id,name,slug,description,status')
      .eq('tenant_id', workspace.tenant.id)
      .order('name')
      .limit(200),
    productQuery.range((page - 1) * CATALOG_PAGE_SIZE, page * CATALOG_PAGE_SIZE - 1),
    workspace.supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', workspace.tenant.id)
      .eq('status', 'ACTIVE'),
  ]);
  if (categoryResult.error || productResult.error || activeCount.error)
    throw new Error('Catalog could not be loaded.');
  await recordServerOperation({
    event: 'SLOW_CATALOG_QUERY',
    operation: 'tenant_catalog_page',
    startedAt,
    tenantId: workspace.tenant.id,
    resultCount: productResult.data?.length ?? 0,
  });
  return {
    ...workspace,
    categories: (categoryResult.data ?? []) as Category[],
    products: (productResult.data ?? []) as Product[],
    total: productResult.count ?? 0,
    activeTotal: activeCount.count ?? 0,
    page,
    search,
    status,
  };
}

export async function getProductEditor(slug: string, productId: string) {
  const workspace = await getTenantWorkspace(slug);
  const [productResult, categoryResult] = await Promise.all([
    workspace.supabase
      .from('products')
      .select(
        'id,name,slug,description,short_description,sku,price,compare_at_price,currency,stock_quantity,track_inventory,status,primary_image_asset_id',
      )
      .eq('tenant_id', workspace.tenant.id)
      .eq('id', productId)
      .maybeSingle(),
    workspace.supabase
      .from('categories')
      .select('id,name,slug,description,status')
      .eq('tenant_id', workspace.tenant.id)
      .neq('status', 'ARCHIVED')
      .order('name')
      .limit(200),
  ]);
  if (productResult.error || categoryResult.error) throw new Error('Product could not be loaded.');
  const product = productResult.data as Product | null;
  if (!product) notFound();
  const [{ data: mappings, error: mappingError }, { data: asset, error: assetError }] =
    await Promise.all([
      workspace.supabase
        .from('product_categories')
        .select('category_id')
        .eq('tenant_id', workspace.tenant.id)
        .eq('product_id', productId),
      product.primary_image_asset_id
        ? workspace.supabase
            .from('media_assets')
            .select('public_url_or_resolvable_key,alt_text,resource_type')
            .eq('tenant_id', workspace.tenant.id)
            .eq('id', product.primary_image_asset_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
  if (mappingError || assetError) throw new Error('Product details could not be loaded.');
  return {
    ...workspace,
    categories: (categoryResult.data ?? []) as Category[],
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
  const startedAt = performance.now();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_public_storefront', { store_slug: slug });
  if (error) {
    await recordServerOperation({
      event: 'PUBLIC_STOREFRONT_QUERY_FAILED',
      operation: 'public_storefront_home',
      startedAt,
      errorCode: error.code,
    });
    throw new Error('Storefront could not be loaded.');
  }
  if (!data) notFound();
  await recordServerOperation({
    event: 'SLOW_PUBLIC_STOREFRONT_QUERY',
    operation: 'public_storefront_home',
    startedAt,
    resultCount: Array.isArray((data as { products?: unknown[] }).products)
      ? (data as { products: unknown[] }).products.length
      : 0,
  });
  return data as PublicStorefront;
});

export const getPublicProduct = cache(async function getPublicProduct(
  slug: string,
  productSlug: string,
) {
  const startedAt = performance.now();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_public_product', {
    store_slug: slug,
    product_slug: productSlug,
  });
  if (error) throw new Error('Product could not be loaded.');
  if (!data) notFound();
  await recordServerOperation({
    event: 'SLOW_PUBLIC_PRODUCT_QUERY',
    operation: 'public_product_detail',
    startedAt,
    resultCount: 1,
  });
  return data as PublicProductResult;
});

function decodeCursor(cursor?: string) {
  if (!cursor) return { createdAt: null, id: null };
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString()) as {
      createdAt?: string;
      id?: string;
    };
    return value.createdAt && value.id
      ? { createdAt: value.createdAt, id: value.id }
      : { createdAt: null, id: null };
  } catch {
    return { createdAt: null, id: null };
  }
}

export async function getPublicProducts(
  slug: string,
  filters: { search?: string; category?: string; cursor?: string } = {},
) {
  const startedAt = performance.now();
  const supabase = await createClient();
  const cursor = decodeCursor(filters.cursor);
  const { data, error } = await supabase.rpc('get_public_products', {
    store_slug: slug,
    search_term: (filters.search ?? '').trim().slice(0, 100),
    category_slug: (filters.category ?? '').trim().slice(0, 100),
    cursor_created_at: cursor.createdAt,
    cursor_id: cursor.id,
    result_limit: 24,
  });
  if (error) throw new Error('Products could not be loaded.');
  if (!data) notFound();
  const result = data as Omit<PublicProductPage, 'nextCursor'>;
  if (filters.category && !result.category) notFound();
  const hasNext = result.products.length > 24;
  const products = result.products.slice(0, 24);
  const last = products.at(-1);
  await recordServerOperation({
    event: 'SLOW_PUBLIC_PRODUCT_PAGE_QUERY',
    operation: 'public_product_page',
    startedAt,
    resultCount: products.length,
  });
  return {
    ...result,
    products,
    nextCursor:
      hasNext && last?.createdAt
        ? Buffer.from(JSON.stringify({ createdAt: last.createdAt, id: last.id })).toString(
            'base64url',
          )
        : null,
  } satisfies PublicProductPage;
}

export async function getPublicSitemapRecords(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_public_sitemap_records', { store_slug: slug });
  if (error) throw new Error('Sitemap records could not be loaded.');
  if (!data) notFound();
  return data as Pick<PublicStorefront, 'tenant' | 'site'> & {
    productSlugs: string[];
    categorySlugs: string[];
  };
}
