'use server';
import { redirect } from 'next/navigation';
import { configuredApplicationBaseUrl } from '@/lib/application-url';
import { createClient } from '@/lib/supabase/server';
export async function signIn(
  _previous: { error: string },
  form: FormData,
): Promise<{ error: string }> {
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    !password ||
    password.length > 1024
  )
    return { error: 'Enter a valid email address and password.' };
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: 'Sign-in failed. Check your credentials and try again.' };
  } catch {
    return { error: 'Unable to connect right now. Please try again.' };
  }
  const invitation = String(form.get('invitation') ?? '');
  redirect(/^[0-9a-f-]{36}$/i.test(invitation) ? `/invite?id=${invitation}` : '/workspace');
}
export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error('Unable to sign out. Please try again.');
  redirect('/login');
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The same reply is returned whether or not the address has an account, so the
// form cannot be used to discover which emails are registered.
const RESET_REQUESTED =
  'If that email belongs to a workspace account, a reset link is on its way. It expires in one hour.';

export type PasswordResetState = { error: string; message: string };

export async function requestPasswordReset(
  _previous: PasswordResetState,
  form: FormData,
): Promise<PasswordResetState> {
  const email = String(form.get('email') ?? '').trim();
  if (!emailPattern.test(email) || email.length > 254)
    return { error: 'Enter the email address you sign in with.', message: '' };
  let redirectTo: string;
  try {
    // Links must point at the trusted configured origin, never the request host.
    redirectTo = new URL('/auth/reset', configuredApplicationBaseUrl()).toString();
  } catch {
    return {
      error: 'Password reset is not available right now. Please try again later.',
      message: '',
    };
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    // Supabase rate limits repeat requests; report that honestly without
    // revealing whether the address exists.
    if (error?.status === 429)
      return { error: 'Please wait a minute before requesting another link.', message: '' };
  } catch {
    return { error: 'Unable to connect right now. Please try again.', message: '' };
  }
  return { error: '', message: RESET_REQUESTED };
}

export async function updatePassword(
  _previous: { error: string },
  form: FormData,
): Promise<{ error: string }> {
  const password = String(form.get('password') ?? '');
  if (password.length < 8 || password.length > 128 || password !== form.get('confirm'))
    return { error: 'Use matching passwords between 8 and 128 characters.' };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Only the session created by a verified reset link (or a signed-in user) may change it.
  if (!user) return { error: 'Your reset link has expired. Request a new one to continue.' };
  const { error } = await supabase.auth.updateUser({ password });
  if (error)
    return { error: 'Password could not be saved. Choose a different password and try again.' };
  redirect('/workspace');
}
