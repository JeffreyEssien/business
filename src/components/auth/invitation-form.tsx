'use client';
import { useActionState } from 'react';
import { verifyInvitation, acceptInvitation } from '@/modules/tenants/invitations';
import { Button } from '@/components/ui/button';
import { FormStack, FormError } from '@/components/ui/form-layout';
/** A new owner verifies an Auth token; an existing owner accepts with their signed-in identity. */
export function InvitationForm({ id, token }: { id: string; token?: string }) {
  const invitationAction = token ? verifyInvitation : acceptInvitation;
  const [state, submitAction, isPending] = useActionState(invitationAction, { error: '' });
  const label = token ? 'Verify invitation →' : 'Accept business invitation →';
  return (
    <FormStack action={submitAction} aria-busy={isPending}>
      <input name="id" type="hidden" value={id} />
      {token && <input name="token_hash" type="hidden" value={token} />}
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Checking invitation…' : label}
      </Button>
      <FormError message={state.error} />
    </FormStack>
  );
}
