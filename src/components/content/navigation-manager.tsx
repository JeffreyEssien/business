'use client';
import { useActionState, useState } from 'react';
import { saveNavigation, type ContentActionState } from '@/modules/content/actions';
import type { NavigationDestination, NavigationEditorItem } from '@/modules/content/types';
import { Button } from '@/components/ui/button';
import { SelectField, TextField } from '@/components/ui/form-fields';
import { FormActions, FormError, FormStack } from '@/components/ui/form-layout';
import styles from './navigation-manager.module.css';

const initialState: ContentActionState = { error: '', message: '' };
const newLink = (): NavigationEditorItem => ({
  id: crypto.randomUUID(),
  label: '',
  target: '/',
  location: 'HEADER',
  linkType: 'URL',
  enabled: true,
  pageId: null,
  categoryId: null,
});

export function NavigationManager({
  slug,
  initialItems,
  pages,
  categories,
}: {
  slug: string;
  initialItems: NavigationEditorItem[];
  pages: NavigationDestination[];
  categories: NavigationDestination[];
}) {
  const [items, setItems] = useState(initialItems);
  const [state, action, pending] = useActionState(saveNavigation.bind(null, slug), initialState);
  const update = (index: number, changes: Partial<NavigationEditorItem>) =>
    setItems((current) =>
      current.map((item, position) => (position === index ? { ...item, ...changes } : item)),
    );
  const move = (index: number, direction: -1 | 1) =>
    setItems((current) => {
      const destination = index + direction;
      if (destination < 0 || destination >= current.length) return current;
      const reordered = [...current];
      [reordered[index], reordered[destination]] = [reordered[destination], reordered[index]];
      return reordered;
    });
  return (
    <FormStack action={action}>
      <input name="navigation" type="hidden" value={JSON.stringify(items)} />
      <FormError message={state.error} />
      {state.message && (
        <p className={styles.success} role="status">
          {state.message}
        </p>
      )}
      <ol className={styles.linkList}>
        {items.map((item, index) => (
          <li key={item.id}>
            <div className={styles.linkHeading}>
              <div>
                <span>Menu link {index + 1}</span>
                <strong>{item.label || 'Untitled link'}</strong>
              </div>
              <div className={styles.rowActions}>
                <Button variant="secondary" onClick={() => move(index, -1)} disabled={index === 0}>
                  Move earlier
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => move(index, 1)}
                  disabled={index === items.length - 1}
                >
                  Move later
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                >
                  Remove link
                </Button>
              </div>
            </div>
            <div className={styles.fields}>
              <TextField
                name={`navigation-label-${index}`}
                label="Text customers see"
                maxLength={60}
                required
                value={item.label}
                onChange={(event) => update(index, { label: event.target.value })}
              />
              <SelectField
                name={`navigation-location-${index}`}
                label="Where should this link appear?"
                value={item.location}
                onChange={(event) =>
                  update(index, {
                    location: event.target.value as NavigationEditorItem['location'],
                  })
                }
                options={[
                  { value: 'HEADER', label: 'Main menu at the top' },
                  { value: 'FOOTER', label: 'Footer at the bottom' },
                ]}
              />
              <SelectField
                name={`navigation-type-${index}`}
                label="Where should customers go?"
                value={item.linkType}
                onChange={(event) =>
                  update(index, {
                    linkType: event.target.value as NavigationEditorItem['linkType'],
                    pageId: null,
                    categoryId: null,
                    target: event.target.value === 'URL' ? '/' : '',
                  })
                }
                options={[
                  { value: 'PAGE', label: 'A page in this store' },
                  { value: 'CATEGORY', label: 'A product collection' },
                  { value: 'URL', label: 'Another web address or homepage section' },
                ]}
              />
              {item.linkType === 'PAGE' && (
                <SelectField
                  name={`navigation-page-${index}`}
                  label="Choose the store page"
                  value={item.pageId ?? ''}
                  onChange={(event) => update(index, { pageId: event.target.value })}
                  required
                  options={[
                    { value: '', label: 'Select a page' },
                    ...pages.map((page) => ({ value: page.id, label: page.name })),
                  ]}
                />
              )}
              {item.linkType === 'CATEGORY' && (
                <SelectField
                  name={`navigation-category-${index}`}
                  label="Choose the product collection"
                  value={item.categoryId ?? ''}
                  onChange={(event) => update(index, { categoryId: event.target.value })}
                  required
                  options={[
                    { value: '', label: 'Select a collection' },
                    ...categories.map((category) => ({
                      value: category.id,
                      label: category.name,
                    })),
                  ]}
                />
              )}
              {item.linkType === 'URL' && (
                <TextField
                  name={`navigation-target-${index}`}
                  label="Web address or store section"
                  hint="Use / for the homepage, /#products for the product area, or a complete HTTPS address."
                  value={item.target}
                  onChange={(event) => update(index, { target: event.target.value })}
                  required
                  maxLength={300}
                />
              )}
              <label className={styles.visibilityOption}>
                <input
                  type="checkbox"
                  checked={item.enabled}
                  onChange={(event) => update(index, { enabled: event.target.checked })}
                />
                <span>
                  <strong>Include this link the next time you publish</strong>
                  <small>Clear this to keep the link saved without showing it to customers.</small>
                </span>
              </label>
            </div>
          </li>
        ))}
      </ol>
      {!items.length && (
        <div className={styles.emptyState}>
          <strong>Your store menus are empty.</strong>
          <p>Add a link so customers can move between important pages and product collections.</p>
        </div>
      )}
      <Button
        variant="secondary"
        onClick={() => setItems((current) => [...current, newLink()])}
        disabled={items.length >= 8}
      >
        {items.length >= 8 ? 'Eight-link limit reached' : 'Add another menu link'}
      </Button>
      <FormActions note="Saving does not change the live store. Publish from Store design when the menu is ready for customers.">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving your store menus…' : 'Save menus for the next publish'}
        </Button>
      </FormActions>
    </FormStack>
  );
}
