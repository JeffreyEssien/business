'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requirePlatformAdmin } from '@/modules/auth/authorization';
import {
  validateBusinessForm,
  provisioningErrorMessage,
  type CreateBusinessInput,
} from './validation';
type ActionState = { error: string };
type CreateBusinessState = ActionState & { values?: CreateBusinessInput };

/** Authenticate every mutation; hiding controls in the UI is not authorization. */
export async function createBusiness(
  _state: CreateBusinessState,
  form: FormData,
): Promise<CreateBusinessState> {
  const { supabase } = await requirePlatformAdmin();
  const validation = validateBusinessForm(form);
  // Return safe form values so React can restore them after a rejected submission.
  if (!validation.valid) return { error: validation.error, values: validation.input };
  const input = validation.input;

  // One RPC owns the transaction, so setup cannot leave a half-created business.
  const { data: tenantId, error } = await supabase.rpc('provision_tenant', {
    business_name: input.name,
    business_slug: input.slug,
    owner_name: input.owner,
    owner_email: input.email,
    template: input.template,
    plan_slug: input.plan,
    payment_mode: input.payment,
  });
  if (error) return { error: provisioningErrorMessage(error.code), values: input };
  revalidatePath('/');
  revalidatePath('/businesses');
  redirect(`/businesses/${tenantId}`);
}
export async function changeSuspension(_state: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requirePlatformAdmin();
  const tenantId = String(form.get('id') ?? '');
  const { error } = await supabase.rpc('set_tenant_suspended', {
    target: tenantId,
    suspended: form.get('suspended') === 'true',
  });
  if (error) return { error: 'Could not change business status. Please try again.' };
  revalidatePath('/');
  revalidatePath('/businesses');
  revalidatePath(`/businesses/${tenantId}`);
  return { error: '' };
}
