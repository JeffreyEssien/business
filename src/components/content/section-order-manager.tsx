'use client';
import { useActionState } from 'react';
import { reorderHomepageSections, type ContentActionState } from '@/modules/content/actions';
import type { SiteSection } from '@/modules/content/types';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-layout';
import styles from './site-editor.module.css';

const initialState: ContentActionState = { error: '', message: '' };
const sectionLanguage: Record<string, { name: string; description: string }> = {
  announcement: {
    name: 'Announcement bar',
    description: 'A short message shown across the top of your store.',
  },
  hero: {
    name: 'Main welcome area',
    description: 'The large headline, introduction, image, and main button customers see first.',
  },
  products: {
    name: 'Product collection',
    description: 'Your available products and the heading above them.',
  },
  footer: {
    name: 'Store contact area',
    description: 'Business details shown at the bottom of every storefront page.',
  },
};

function MoveSectionForm({
  slug,
  keys,
  label,
  disabled,
}: {
  slug: string;
  keys: string[];
  label: string;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState(
    reorderHomepageSections.bind(null, slug, keys),
    initialState,
  );
  return (
    <form action={action}>
      <Button type="submit" variant="secondary" disabled={disabled || pending} aria-label={label}>
        {pending ? 'Moving…' : label}
      </Button>
      <FormError message={state.error} />
      {state.message && (
        <p className={styles.orderMessage} role="status">
          {state.message}
        </p>
      )}
    </form>
  );
}

export function SectionOrderManager({ slug, sections }: { slug: string; sections: SiteSection[] }) {
  const keys = sections.map((section) => section.key);
  return (
    <section className={styles.orderPanel} aria-labelledby="homepage-order-heading">
      <div>
        <h2 id="homepage-order-heading">Choose what customers see first</h2>
        <p>
          Move homepage areas into the order that best tells your story. This changes only your
          saved version until you publish it.
        </p>
      </div>
      <ol className={styles.orderList}>
        {sections.map((section, index) => {
          const language = sectionLanguage[section.key] ?? {
            name: section.key,
            description: 'A section of your homepage.',
          };
          const move = (to: number) => {
            const reordered = [...keys];
            const [item] = reordered.splice(index, 1);
            reordered.splice(to, 0, item);
            return reordered;
          };
          return (
            <li key={section.key}>
              <span className={styles.orderNumber}>{index + 1}</span>
              <div className={styles.orderCopy}>
                <strong>{language.name}</strong>
                <p>{language.description}</p>
              </div>
              <div className={styles.orderActions}>
                <MoveSectionForm
                  slug={slug}
                  keys={index > 0 ? move(index - 1) : keys}
                  label={`Move ${language.name} earlier`}
                  disabled={index === 0}
                />
                <MoveSectionForm
                  slug={slug}
                  keys={index < keys.length - 1 ? move(index + 1) : keys}
                  label={`Move ${language.name} later`}
                  disabled={index === keys.length - 1}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
