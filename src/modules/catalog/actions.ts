'use server';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getTenantWorkspace } from '@/modules/tenants/workspace-query';
import { catalogErrorMessage, validateCategory, validateProduct } from './validation';

export type CatalogActionState = { error: string };
const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const imageExtensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function canEdit(role: string) {
  return ['TENANT_OWNER', 'TENANT_ADMIN', 'TENANT_MANAGER'].includes(role);
}

async function editorWorkspace(slug: string) {
  const workspace = await getTenantWorkspace(slug);
  if (!canEdit(workspace.membership.role)) throw new Error('FORBIDDEN');
  return workspace;
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
  let uploadedKey: string | null = null;
  let publicUrl: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (!imageTypes.has(file.type) || file.size > 5 * 1024 * 1024)
      return { error: 'Upload a JPG, PNG, WebP, or GIF image up to 5 MB.' };
    uploadedKey = `tenants/${tenant.id}/products/${randomUUID()}.${imageExtensions[file.type]}`;
    const upload = await supabase.storage.from('catalog-media').upload(uploadedKey, file, {
      contentType: file.type,
      upsert: false,
    });
    if (upload.error) return { error: 'The product image could not be uploaded.' };
    publicUrl = supabase.storage.from('catalog-media').getPublicUrl(uploadedKey).data.publicUrl;
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
    asset_storage_key: uploadedKey,
    asset_public_url: publicUrl,
    asset_file_name: uploadedKey && file instanceof File ? file.name.slice(0, 255) : null,
    asset_mime_type: uploadedKey && file instanceof File ? file.type : null,
    asset_file_size: uploadedKey && file instanceof File ? file.size : null,
    asset_alt_text: uploadedKey ? validation.input.altText : null,
  });
  if (error) {
    if (uploadedKey) await supabase.storage.from('catalog-media').remove([uploadedKey]);
    return { error: catalogErrorMessage(error.code, error.message) };
  }
  revalidatePath(`/t/${slug}`);
  revalidatePath(`/t/${slug}/catalog`);
  revalidatePath(`/store/${slug}`);
  redirect(`/t/${slug}/catalog`);
}

export async function removeProduct(slug: string, productId: string, _form?: FormData) {
  const { tenant, supabase } = await editorWorkspace(slug);
  const { error } = await supabase.rpc('delete_product', {
    target_tenant: tenant.id,
    target_product: productId,
  });
  if (error) throw new Error(catalogErrorMessage(error.code, error.message));
  revalidatePath(`/t/${slug}`);
  revalidatePath(`/t/${slug}/catalog`);
  revalidatePath(`/store/${slug}`);
}
