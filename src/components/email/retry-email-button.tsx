'use client';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { FormError, FormStack } from '@/components/ui/form-layout';
import { retryEmailNotification } from '@/modules/email/actions';

export function RetryEmailButton({ id }: { id: string }) {
  const action = retryEmailNotification.bind(null, id);
  const [state, submitAction, pending] = useActionState(action, { error: '', message: '' });
  return (
    <FormStack action={submitAction} aria-busy={pending}>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? 'Retrying…' : 'Retry delivery'}
      </Button>
      <FormError message={state.error} />
      {state.message && <small role="status">{state.message}</small>}
    </FormStack>
  );
}
