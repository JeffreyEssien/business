'use client';
import { useActionState } from 'react';
import { setOwnerPassword } from '@/modules/tenants/invitations';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/form-fields';
import { FormStack, FormError } from '@/components/ui/form-layout';
export function PasswordForm({ id }: { id: string }) {
  const [state, submitAction, isPending] = useActionState(setOwnerPassword, { error: '' });
  return (
    <FormStack action={submitAction} aria-busy={isPending}>
      <input type="hidden" name="id" value={id} />
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
        {isPending ? 'Saving…' : 'Set password & open workspace →'}
      </Button>
      <FormError message={state.error} />
    </FormStack>
  );
}
