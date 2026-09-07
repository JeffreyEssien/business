'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requirePlatformAdmin } from '@/modules/auth/authorization';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function generateOwnerLink(
  _state: { error: string; link: string },
  form: FormData,
): Promise<{ error: string; link: string }> {
  const { supabase } = await requirePlatformAdmin();
  const id = String(form.get('id') ?? '');
  if (!uuid.test(id)) return { error: 'Invalid invitation.', link: '' };
  const { data: invitation, error } = await supabase
    .from('tenant_invitations')
    .select('id,email,status,tenant_id')
    .eq('id', id)
    .single();
  if (error || invitation.status !== 'PENDING')
    return { error: 'This invitation is unavailable or already accepted.', link: '' };
  const { data: tenant } = await supabase
    .from('tenants')
    .select('status')
    .eq('id', invitation.tenant_id)
    .single();
  if (!tenant || !['PROVISIONING', 'TRIAL', 'ACTIVE'].includes(tenant.status))
    return { error: 'Reactivate the business before generating an invitation.', link: '' };
  try {
    const base = new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000');
    const link = new URL('/invite', base);
    link.searchParams.set('id', id);
    const admin = createAdminClient();
    const { data: profile, error: lookupError } = await supabase
      .from('users')
      .select('auth_user_id')
      .eq('email', invitation.email)
      .maybeSingle();
    if (lookupError) return { error: 'Owner account could not be checked.', link: '' };
    let confirmed = false;
    if (profile) {
      const { data, error: authError } = await admin.auth.admin.getUserById(profile.auth_user_id);
      if (authError) return { error: 'Owner account could not be checked.', link: '' };
      confirmed = Boolean(data.user?.email_confirmed_at);
    }
    if (!confirmed) {
      const { data, error: linkError } = await admin.auth.admin.generateLink({
        type: 'invite',
        email: invitation.email,
      });
      if (linkError || !data.properties?.hashed_token)
        return {
          error:
            'The invitation link could not be generated. If this email already has an account, ask the owner to sign in and use the invitation page.',
          link: '',
        };
      link.searchParams.set('token_hash', data.properties.hashed_token);
    }
    const { error: auditError } = await supabase.rpc('record_invitation_link', {
      invitation_id: id,
    });
    if (auditError)
      return { error: 'Could not record the invitation event. Please retry.', link: '' };
    return { error: '', link: link.toString() };
  } catch {
    return { error: 'Invitation service is unavailable. Please retry.', link: '' };
  }
}
export async function verifyInvitation(
  _state: { error: string },
  form: FormData,
): Promise<{ error: string }> {
  const id = String(form.get('id') ?? ''),
    token = String(form.get('token_hash') ?? '');
  if (!uuid.test(id) || !token || token.length > 1024)
    return { error: 'This invitation link is invalid.' };
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: token, type: 'invite' });
  if (error)
    return {
      error:
        'This link has expired or was already used. Ask the platform owner for a new link, or sign in if you have already set your password.',
    };
  redirect(`/account?invitation=${id}`);
}
export async function acceptInvitation(
  _state: { error: string },
  form: FormData,
): Promise<{ error: string }> {
  const id = String(form.get('id') ?? '');
  if (!uuid.test(id)) return { error: 'Invalid invitation.' };
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Sign in before accepting the invitation.' };
  const { data: slug, error } = await supabase.rpc('accept_tenant_invitation', {
    invitation_id: id,
  });
  if (error)
    return {
      error:
        'This invitation is not available to this account. Check the owner email or contact the platform administrator.',
    };
  revalidatePath('/businesses');
  revalidatePath('/');
  redirect(`/t/${slug}`);
}
export async function setOwnerPassword(
  _state: { error: string },
  form: FormData,
): Promise<{ error: string }> {
  const password = String(form.get('password') ?? '');
  if (password.length < 8 || password.length > 128 || password !== form.get('confirm'))
    return { error: 'Use matching passwords between 8 and 128 characters.' };
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { error: 'Your session expired. Open a new invitation link.' };
  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError)
    return { error: 'Password could not be saved. Check your password strength and try again.' };
  return acceptInvitation(_state, form);
}
