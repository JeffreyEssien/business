'use server';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  deleteCloudinaryMedia,
  uploadCatalogMedia,
  type CloudinaryResourceType,
  type UploadedMedia,
} from '@/lib/cloudinary/server';
import { getTenantWorkspace } from '@/modules/tenants/workspace-query';
import { catalogErrorMessage, validateCategory, validateProduct } from './validation';

export type CatalogActionState = { error: string };
const mediaTypes: Record<string, CloudinaryResourceType> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'image/gif': 'image',
  'video/mp4': 'video',
  'video/webm': 'video',
};

type StoredMedia = {
  id: string;
  storage_provider: string;
  storage_key: string;
  resource_type: CloudinaryResourceType;
};

function canEdit(role: string) {
  return ['TENANT_OWNER', 'TENANT_ADMIN', 'TENANT_MANAGER'].includes(role);
}

async function editorWorkspace(slug: string) {
  const workspace = await getTenantWorkspace(slug);
  if (!canEdit(workspace.membership.role)) throw new Error('FORBIDDEN');
  return workspace;
}

async function deleteProviderMedia(
  media: StoredMedia,
  supabase: Awaited<ReturnType<typeof editorWorkspace>>['supabase'],
) {
  if (media.storage_provider === 'cloudinary')
    await deleteCloudinaryMedia(media.storage_key, media.resource_type);
  else if (media.storage_provider === 'supabase')
    await supabase.storage.from('catalog-media').remove([media.storage_key]);
}

export async function saveCategory(
  slug: string,
  categoryId: string | null,
  _state: CatalogActionState,
  form: FormData,
): Promise<CatalogActionState> {
  const validation = validateCategory(form);
  if (!validation.input) return { error: validation.error ?? 'Invalid category.' };
  const { tenant, supabase } = await editorWorkspace(slug);
  const { error } = await supabase.rpc('save_category', {
    target_tenant: tenant.id,
    target_category: categoryId,
    category_name: validation.input.name,
    category_slug: validation.input.slug,
    category_description: validation.input.description,
    category_status: validation.input.status,
  });
  if (error) return { error: catalogErrorMessage(error.code, error.message) };
  revalidatePath(`/t/${slug}/catalog`);
  revalidatePath(`/t/${slug}/catalog/categories`);
  return { error: '' };
}

export async function removeCategory(slug: string, categoryId: string, _form?: FormData) {
  const { tenant, supabase } = await editorWorkspace(slug);
  const { error } = await supabase.rpc('delete_category', {
    target_tenant: tenant.id,
    target_category: categoryId,
  });
  if (error) throw new Error(catalogErrorMessage(error.code, error.message));
  revalidatePath(`/t/${slug}/catalog`);
  revalidatePath(`/t/${slug}/catalog/categories`);
}

export async function saveProduct(
  slug: string,
  productId: string | null,
  _state: CatalogActionState,
  form: FormData,
): Promise<CatalogActionState> {
  const validation = validateProduct(form);
  if (!validation.input) return { error: validation.error ?? 'Invalid product.' };
  const { tenant, supabase } = await editorWorkspace(slug);
  const file = form.get('image');
  let upload: UploadedMedia | null = null;
  let previousMedia: StoredMedia | null = null;
  if (file instanceof File && file.size > 0) {
    const resourceType = mediaTypes[file.type];
    if (!resourceType || file.size > 5 * 1024 * 1024)
      return { error: 'Upload a JPG, PNG, WebP, GIF, MP4, or WebM file up to 5 MB.' };
    if (productId) {
      const { data: product } = await supabase
        .from('products')
        .select('primary_image_asset_id')
        .eq('tenant_id', tenant.id)
        .eq('id', productId)
        .maybeSingle();
      if (product?.primary_image_asset_id) {
        const { data } = await supabase
          .from('media_assets')
          .select('id,storage_provider,storage_key,resource_type')
          .eq('tenant_id', tenant.id)
          .eq('id', product.primary_image_asset_id)
          .maybeSingle();
        previousMedia = data as StoredMedia | null;
      }
    }
    try {
      upload = await uploadCatalogMedia(file, tenant.id, randomUUID(), resourceType);
    } catch {
      return { error: 'The product media could not be uploaded to Cloudinary.' };
    }
  }
  const { error } = await supabase.rpc('save_product', {
    target_tenant: tenant.id,
    target_product: productId,
    product_name: validation.input.name,
    product_slug: validation.input.slug,
    product_description: validation.input.description,
    product_short_description: validation.input.shortDescription,
    product_sku: validation.input.sku,
    product_price: validation.input.price,
    product_compare_at_price: validation.input.compareAtPrice,
    product_stock_quantity: validation.input.stockQuantity,
    product_track_inventory: validation.input.trackInventory,
    product_status: validation.input.status,
    category_ids: validation.input.categoryIds,
    asset_storage_key: upload?.publicId ?? null,
    asset_public_url: upload?.secureUrl ?? null,
    asset_file_name: upload && file instanceof File ? file.name.slice(0, 255) : null,
    asset_mime_type: upload && file instanceof File ? file.type : null,
    asset_file_size: upload?.bytes ?? null,
    asset_alt_text: upload ? validation.input.altText : null,
    asset_storage_provider: upload?.provider ?? null,
    asset_resource_type: upload?.resourceType ?? null,
    asset_format: upload?.format ?? null,
    asset_width: upload?.width ?? null,
    asset_height: upload?.height ?? null,
  });
  if (error) {
    if (upload) await deleteCloudinaryMedia(upload.publicId, upload.resourceType).catch(() => {});
    return { error: catalogErrorMessage(error.code, error.message) };
  }
  if (previousMedia && upload) await deleteProviderMedia(previousMedia, supabase).catch(() => {});
  revalidatePath(`/t/${slug}`);
  revalidatePath(`/t/${slug}/catalog`);
  revalidatePath(`/store/${slug}`);
  redirect(`/t/${slug}/catalog`);
}

export async function removeProduct(slug: string, productId: string, _form?: FormData) {
  const { tenant, supabase } = await editorWorkspace(slug);
  const [productResult, mappingResult] = await Promise.all([
    supabase
      .from('products')
      .select('primary_image_asset_id')
      .eq('tenant_id', tenant.id)
      .eq('id', productId)
      .maybeSingle(),
    supabase
      .from('product_media')
      .select('asset_id')
      .eq('tenant_id', tenant.id)
      .eq('product_id', productId),
  ]);
  if (productResult.error || mappingResult.error)
    throw new Error('Product media could not be resolved for deletion.');
  const assetIds = [
    productResult.data?.primary_image_asset_id,
    ...(mappingResult.data ?? []).map((item) => item.asset_id),
  ].filter((id, index, all): id is string => Boolean(id) && all.indexOf(id) === index);
  const { data: media, error: mediaError } = assetIds.length
    ? await supabase
        .from('media_assets')
        .select('id,storage_provider,storage_key,resource_type')
        .eq('tenant_id', tenant.id)
        .in('id', assetIds)
    : { data: [], error: null };
  if (mediaError) throw new Error('Product media could not be loaded for deletion.');
  const { error } = await supabase.rpc('delete_product', {
    target_tenant: tenant.id,
    target_product: productId,
  });
  if (error) throw new Error(catalogErrorMessage(error.code, error.message));
  await Promise.all(
    ((media ?? []) as StoredMedia[]).map((asset) => deleteProviderMedia(asset, supabase)),
  );
  revalidatePath(`/t/${slug}`);
  revalidatePath(`/t/${slug}/catalog`);
  revalidatePath(`/store/${slug}`);
}
