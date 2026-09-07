'use client';
import { useActionState } from 'react';
import { signIn } from '@/modules/auth/actions';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/form-fields';
import { FormStack, FormError } from '@/components/ui/form-layout';
export function LoginForm({ invitation = '' }: { invitation?: string }) {
  const [state, submitAction, isPending] = useActionState(signIn, { error: '' });
  return (
    <FormStack action={submitAction} aria-busy={isPending}>
      <input type="hidden" name="invitation" value={invitation} />
      <TextField
        name="email"
        label="Email address"
        type="email"
        autoComplete="username"
        required
        maxLength={254}
      />
      <TextField
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        required
        maxLength={1024}
      />
      <FormError message={state.error} />
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Signing in…' : 'Sign in to your workspace →'}
      </Button>
    </FormStack>
  );
}
