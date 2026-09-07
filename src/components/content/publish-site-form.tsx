'use client';
import { useActionState } from 'react';
import { publishSite, type ContentActionState } from '@/modules/content/actions';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-layout';
import styles from './site-editor.module.css';

const initialState: ContentActionState = { error: '', message: '' };
export function PublishSiteForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(publishSite.bind(null, slug), initialState);
  return (
    <form action={action} className={styles.publishForm}>
      <FormError message={state.error} />
      {state.message && (
        <p className={styles.success} role="status">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? 'Publishing…' : 'Publish saved draft'}
      </Button>
    </form>
  );
}
