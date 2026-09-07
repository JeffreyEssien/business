import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
export const requirePlatformAdmin = cache(async function requirePlatformAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect('/login');
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id,platform_role,status')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (profileError) throw new Error('Account permissions could not be verified.');
  if (profile?.status !== 'ACTIVE' || profile.platform_role !== 'SUPER_ADMIN')
    redirect('/login?error=access');
  return { supabase, user, profile };
});
