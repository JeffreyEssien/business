import type { CatalogStatus } from './types';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const statuses = new Set<CatalogStatus>(['DRAFT', 'ACTIVE', 'ARCHIVED']);

export function normalizeSlug(value: string) {
  return value.trim().toLowerCase();
}

export function validateCategory(form: FormData) {
  const input = {
    name: String(form.get('name') ?? '').trim(),
    slug: normalizeSlug(String(form.get('slug') ?? '')),
    description: String(form.get('description') ?? '').trim(),
    status: String(form.get('status') ?? 'ACTIVE') as CatalogStatus,
  };
  if (!input.name || input.name.length > 100) return { error: 'Enter a category name.' };
  if (!slugPattern.test(input.slug) || input.slug.length > 100)
    return { error: 'Use a lowercase category handle with letters, numbers, and hyphens.' };
  if (!statuses.has(input.status)) return { error: 'Choose a valid category status.' };
  return { input };
}

export function validateProduct(form: FormData) {
  const price = Number(form.get('price'));
  const compareValue = String(form.get('compareAtPrice') ?? '').trim();
  const compareAtPrice = compareValue ? Number(compareValue) : null;
  const stockQuantity = Number(form.get('stockQuantity'));
  const input = {
    name: String(form.get('name') ?? '').trim(),
    slug: normalizeSlug(String(form.get('slug') ?? '')),
    shortDescription: String(form.get('shortDescription') ?? '').trim(),
    description: String(form.get('description') ?? '').trim(),
    sku: String(form.get('sku') ?? '').trim(),
    price,
    compareAtPrice,
    stockQuantity,
    trackInventory: form.get('trackInventory') === 'on',
    status: String(form.get('status') ?? 'DRAFT') as CatalogStatus,
    categoryIds: form.getAll('categoryIds').map(String),
    altText: String(form.get('altText') ?? '').trim(),
  };
  if (!input.name || input.name.length > 160) return { error: 'Enter a product name.' };
  if (!slugPattern.test(input.slug) || input.slug.length > 160)
    return { error: 'Use a lowercase product handle with letters, numbers, and hyphens.' };
  if (!Number.isFinite(price) || price < 0) return { error: 'Enter a valid non-negative price.' };
  if (compareAtPrice !== null && (!Number.isFinite(compareAtPrice) || compareAtPrice < price))
    return { error: 'Compare-at price must be at least the selling price.' };
  if (!Number.isInteger(stockQuantity) || stockQuantity < 0)
    return { error: 'Stock quantity must be a non-negative whole number.' };
  if (!statuses.has(input.status)) return { error: 'Choose a valid product status.' };
  return { input };
}

export function catalogErrorMessage(code?: string, message?: string) {
  if (code === '23505') return 'That handle or SKU is already in use.';
  if (message?.includes('PRODUCT_LIMIT_REACHED'))
    return 'This business has reached its product limit.';
  if (message?.includes('FORBIDDEN')) return 'You do not have permission to change this catalog.';
  return 'The catalog could not be saved. Please review the details and try again.';
}
