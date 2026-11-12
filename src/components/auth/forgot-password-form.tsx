'use client';
import { useActionState } from 'react';
import { requestPasswordReset } from '@/modules/auth/actions';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/form-fields';
import { FormStack, FormError, FormNotice } from '@/components/ui/form-layout';

export function ForgotPasswordForm({ linkExpired = false }: { linkExpired?: boolean }) {
  const [state, submitAction, isPending] = useActionState(requestPasswordReset, {
    error: '',
    message: '',
  });
  return (
    <FormStack action={submitAction} aria-busy={isPending}>
      {linkExpired && !state.message && (
        <FormError message="That reset link has expired or was already used. Request a new one below." />
      )}
      <TextField
        name="email"
        label="Email address"
        type="email"
        autoComplete="username"
        required
        maxLength={254}
        hint="We will email you a link to choose a new password."
      />
      <FormError message={state.error} />
      <FormNotice message={state.message} />
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Sending…' : 'Email me a reset link →'}
      </Button>
    </FormStack>
  );
}
