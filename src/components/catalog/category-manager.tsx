'use client';
import { useActionState } from 'react';
import { removeCategory, saveCategory, type CatalogActionState } from '@/modules/catalog/actions';
import type { Category } from '@/modules/catalog/types';
import { Button } from '@/components/ui/button';
import { TextAreaField, TextField, SelectField } from '@/components/ui/form-fields';
import { FormActions, FormError, FormGrid, FormStack } from '@/components/ui/form-layout';
import styles from './catalog.module.css';

const initialState: CatalogActionState = { error: '' };
function CategoryEditForm({ slug, category }: { slug: string; category: Category }) {
  const [state, action, pending] = useActionState(
    saveCategory.bind(null, slug, category.id),
    initialState,
  );
  return (
    <FormStack action={action}>
      <FormError message={state.error} />
      <FormGrid>
        <TextField
          name="name"
          label="Category name"
          required
          maxLength={100}
          defaultValue={category.name}
        />
        <TextField
          name="slug"
          label="Handle"
          required
          maxLength={100}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          defaultValue={category.slug}
        />
        <TextAreaField
          name="description"
          label="Description"
          maxLength={1000}
          defaultValue={category.description}
        />
        <SelectField
          name="status"
          label="Status"
          defaultValue={category.status}
          options={[
            { value: 'ACTIVE', label: 'Active' },
            { value: 'DRAFT', label: 'Draft' },
            { value: 'ARCHIVED', label: 'Archived' },
          ]}
        />
      </FormGrid>
      <FormActions>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
      </FormActions>
    </FormStack>
  );
}
export function CategoryManager({ slug, categories }: { slug: string; categories: Category[] }) {
  const [state, action, pending] = useActionState(
    saveCategory.bind(null, slug, null),
    initialState,
  );
  return (
    <div className="section-stack">
      <FormStack action={action}>
        <FormError message={state.error} />
        <FormGrid>
          <TextField name="name" label="Category name" required maxLength={100} />
          <TextField
            name="slug"
            label="Handle"
            hint="Lowercase letters, numbers, and hyphens."
            required
            maxLength={100}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
          />
          <TextAreaField name="description" label="Description" maxLength={1000} />
          <SelectField
            name="status"
            label="Status"
            options={[
              { value: 'ACTIVE', label: 'Active' },
              { value: 'DRAFT', label: 'Draft' },
              { value: 'ARCHIVED', label: 'Archived' },
            ]}
          />
        </FormGrid>
        <FormActions>
          <Button type="submit" disabled={pending}>
            {pending ? 'Adding…' : 'Add category'}
          </Button>
        </FormActions>
      </FormStack>
      <div className={styles.categoryList}>
        {categories.map((category) => (
          <div className={styles.categoryRow} key={category.id}>
            <div>
              <strong>{category.name}</strong>
              <p>
                {category.description || category.slug} · {category.status}
              </p>
              <details>
                <summary>Edit category</summary>
                <CategoryEditForm slug={slug} category={category} />
              </details>
            </div>
            <form action={removeCategory.bind(null, slug, category.id)}>
              <button className={styles.dangerButton} type="submit">
                Delete
              </button>
            </form>
          </div>
        ))}
        {!categories.length && <p>No categories yet.</p>}
      </div>
    </div>
  );
}
