'use client';
import { useActionState } from 'react';
import { generateOwnerLink } from '@/modules/tenants/invitations';
import { changeSuspension } from '@/modules/tenants/actions';
import { Button } from '@/components/ui/button';
import { CopyField } from '@/components/ui/copy-field';
import { FormStack, FormError } from '@/components/ui/form-layout';
export function InvitationControl({ id }: { id: string }) {
  const [state, submitAction, isPending] = useActionState(generateOwnerLink, {
    error: '',
    link: '',
  });
  const isLocalLink = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(state.link);
  return (
    <div className="section-stack">
      <FormStack action={submitAction} aria-busy={isPending}>
        <input type="hidden" name="id" value={id} />
        <Button type="submit" variant="secondary" disabled={isPending}>
          {isPending ? 'Generating…' : 'Generate owner invitation link'}
        </Button>
        <FormError message={state.error} />
      </FormStack>
      {state.link && (
        <div className="section-stack">
          <CopyField name="invitation-link" label="Owner invitation link" value={state.link} />
          <p>
            Share privately with the named owner. New-account links expire according to your
            Supabase invitation settings. No email has been sent.
          </p>
          {isLocalLink && (
            <p>
              This invitation uses a local address. Test it on this computer; remote owners will
              need the deployed app address.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
export function SuspensionControl({ id, suspended }: { id: string; suspended: boolean }) {
  const [state, submitAction, isPending] = useActionState(changeSuspension, { error: '' });
  return (
    <FormStack action={submitAction} aria-busy={isPending}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="suspended" value={String(!suspended)} />
      <Button type="submit" variant="secondary" disabled={isPending}>
        {isPending ? 'Updating…' : suspended ? 'Reactivate business' : 'Suspend business'}
      </Button>
      <FormError message={state.error} />
    </FormStack>
  );
}
