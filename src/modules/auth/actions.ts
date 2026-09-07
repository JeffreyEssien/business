'use server';
import { redirect } from 'next/navigation';
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
