'use client';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/form-fields';
import { FormStack, FormError } from '@/components/ui/form-layout';

type PasswordAction = (state: { error: string }, form: FormData) => Promise<{ error: string }>;

/** New-password form shared by owner invitation acceptance and password reset. */
export function PasswordForm({
  action,
  submitLabel,
  id,
}: {
  action: PasswordAction;
  submitLabel: string;
  id?: string;
}) {
  const [state, submitAction, isPending] = useActionState(action, { error: '' });
  return (
    <FormStack action={submitAction} aria-busy={isPending}>
      {id && <input type="hidden" name="id" value={id} />}
      <TextField
        name="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        maxLength={128}
        required
        hint="Use at least 8 characters."
      />
      <TextField
        name="confirm"
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        maxLength={128}
        required
      />
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Saving…' : submitLabel}
      </Button>
      <FormError message={state.error} />
    </FormStack>
  );
}
