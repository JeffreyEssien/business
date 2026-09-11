import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/** Tenant resolution and membership authorization run before any workspace is rendered. */
export async function getTenantWorkspace(slug: string) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect('/login');
  const { data: profile } = await supabase
    .from('users')
    .select('id,status')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (!profile || profile.status !== 'ACTIVE') notFound();
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id,name,status,template_key')
    .eq('slug', slug)
    .maybeSingle();
  if (tenantError) throw new Error('Workspace could not be loaded.');
  if (!tenant) notFound();
  const { data: membership, error: memberError } = await supabase
    .from('tenant_memberships')
    .select('user_id,role')
    .eq('tenant_id', tenant.id)
    .eq('user_id', profile.id)
    .eq('status', 'ACTIVE')
    .maybeSingle();
  if (memberError) throw new Error('Membership could not be verified.');
  if (!membership) notFound();
  const { data: setup, error: setupError } = await supabase
    .from('tenant_onboarding')
    .select('*')
    .eq('tenant_id', tenant.id)
    .single();
  if (setupError) throw new Error('Onboarding could not be loaded.');

  return { tenant, setup, membership, supabase };
}
