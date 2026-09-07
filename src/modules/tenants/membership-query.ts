import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/** Resolve only memberships belonging to the signed-in identity, with RLS as a second boundary. */
export async function listMyWorkspaces() {
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
  if (profileError) throw new Error('Could not verify account.');
  if (profile?.status === 'ACTIVE' && profile.platform_role === 'SUPER_ADMIN') redirect('/');
  const { data: memberships, error: membershipError } = await supabase
    .from('tenant_memberships')
    .select('tenant_id,tenants(name,slug)')
    .eq('user_id', profile?.id ?? '00000000-0000-0000-0000-000000000000')
    .eq('status', 'ACTIVE')
    .limit(100);
  if (membershipError) throw new Error('Could not load memberships.');
  const businesses = (memberships ?? []) as unknown as {
    tenant_id: string;
    tenants: { name: string; slug: string } | null;
  }[];
  return businesses;
}
