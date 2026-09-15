'use client';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { FormError, FormStack } from '@/components/ui/form-layout';
import { retrySmsNotification } from '@/modules/sms/actions';

export function RetrySmsButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(retrySmsNotification.bind(null, id), {
    error: '',
    message: '',
  });
  return (
    <FormStack action={action} aria-busy={pending}>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? 'Queuing…' : 'Retry safe failure'}
      </Button>
      <FormError message={state.error} />
      {state.message && <small role="status">{state.message}</small>}
    </FormStack>
  );
}
