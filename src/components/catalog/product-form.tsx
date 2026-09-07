'use client';
import { useActionState } from 'react';
import { saveProduct, type CatalogActionState } from '@/modules/catalog/actions';
import type { Category, Product } from '@/modules/catalog/types';
import { Button, ButtonLink } from '@/components/ui/button';
import { SelectField, TextAreaField, TextField } from '@/components/ui/form-fields';
import {
  FormActions,
  FormError,
  FormGrid,
  FormSection,
  FormStack,
} from '@/components/ui/form-layout';
import { CatalogMedia } from './catalog-media';
import styles from './catalog.module.css';

const initialState: CatalogActionState = { error: '' };
export function ProductForm({
  slug,
  categories,
  product,
}: {
  slug: string;
  categories: Category[];
  product?: Product;
}) {
  const [state, action, pending] = useActionState(
    saveProduct.bind(null, slug, product?.id ?? null),
    initialState,
  );
  return (
    <FormStack action={action}>
      <FormError message={state.error} />
      <FormSection title="Product details">
        <FormGrid>
          <TextField
            name="name"
            label="Product name"
            required
            maxLength={160}
            defaultValue={product?.name}
          />
          <TextField
            name="slug"
            label="Handle"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            defaultValue={product?.slug}
            hint="Used in the public product URL."
          />
          <TextAreaField
            name="shortDescription"
            label="Short description"
            maxLength={240}
            defaultValue={product?.short_description}
          />
          <TextAreaField
            name="description"
            label="Full description"
            maxLength={5000}
            defaultValue={product?.description}
          />
          <TextField name="sku" label="SKU" maxLength={100} defaultValue={product?.sku ?? ''} />
          <SelectField
            name="status"
            label="Status"
            defaultValue={product?.status ?? 'DRAFT'}
            options={[
              { value: 'DRAFT', label: 'Draft' },
              { value: 'ACTIVE', label: 'Active' },
              { value: 'ARCHIVED', label: 'Archived' },
            ]}
          />
        </FormGrid>
      </FormSection>
      <FormSection title="Pricing and inventory">
        <FormGrid>
          <TextField
            name="price"
            label="Price (NGN)"
            type="number"
            min="0"
            step="0.01"
            required
            defaultValue={product?.price ?? 0}
          />
          <TextField
            name="compareAtPrice"
            label="Compare-at price"
            type="number"
            min="0"
            step="0.01"
            defaultValue={product?.compare_at_price ?? ''}
          />
          <TextField
            name="stockQuantity"
            label="Stock quantity"
            type="number"
            min="0"
            step="1"
            required
            defaultValue={product?.stock_quantity ?? 0}
          />
          <label className={styles.checkbox}>
            <input
              name="trackInventory"
              type="checkbox"
              defaultChecked={product?.track_inventory ?? true}
            />{' '}
            Track inventory
          </label>
        </FormGrid>
      </FormSection>
      <FormSection
        title="Organization and media"
        description="Images or videos must be JPG, PNG, WebP, GIF, MP4, or WebM and no larger than 5 MB."
      >
        <FormGrid>
          <SelectField
            name="categoryIds"
            label="Categories"
            multiple
            defaultValue={product?.category_ids}
            options={categories.map((category) => ({ value: category.id, label: category.name }))}
            hint="Hold Ctrl or Command to select more than one."
          />
          <TextField
            name="image"
            label={product?.media_url ? 'Replace primary media' : 'Primary media'}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
          />
          <TextField
            name="altText"
            label="Media alt text or caption"
            maxLength={240}
            defaultValue={product?.media_alt ?? ''}
            hint="Describe meaningful media for accessibility."
          />
          {product?.media_url && (
            <CatalogMedia
              className={styles.imagePreview}
              url={product.media_url}
              type={product.media_type}
              alt={product.media_alt || product.name}
            />
          )}
        </FormGrid>
      </FormSection>
      <FormActions note="Active products appear immediately in the public catalog.">
        <div className={styles.rowActions}>
          <ButtonLink variant="secondary" href={`/t/${slug}/catalog`}>
            Cancel
          </ButtonLink>
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save product'}
          </Button>
        </div>
      </FormActions>
    </FormStack>
  );
}
