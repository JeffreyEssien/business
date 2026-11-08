'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { publishSite, type ContentActionState } from '@/modules/content/actions';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-layout';
import styles from './site-editor.module.css';

const initialState: ContentActionState = { error: '', message: '' };
export function PublishSiteForm({
  slug,
  audience = 'customers',
}: {
  slug: string;
  audience?: 'customers' | 'visitors';
}) {
  const [state, action, pending] = useActionState(publishSite.bind(null, slug), initialState);
  const live =
    audience === 'visitors' ? 'Make my portfolio live' : 'Make saved changes visible to customers';
  return (
    <form action={action} className={styles.publishForm}>
      <FormError message={state.error} />
      {!!state.remaining?.length && (
        <ul className={styles.remainingList}>
          {state.remaining.map((item) => (
            <li key={item.href}>
              <Link href={item.href}>{item.label}</Link>
            </li>
          ))}
        </ul>
      )}
      {state.message && (
        <p className={styles.success} role="status">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? 'Making changes visible…' : live}
      </Button>
    </form>
  );
}
