'use client';

import { useFormStatus } from 'react-dom';
import { signOut } from '@/modules/auth/actions';
import { Button } from '@/components/ui/button';

function SignOutButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? 'Signing out…' : 'Sign out'}
    </Button>
  );
}

export function SignOutForm() {
  return (
    <form action={signOut} aria-label="Sign out">
      <SignOutButton />
    </form>
  );
}
