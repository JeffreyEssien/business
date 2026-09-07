import 'server-only';
import { BUSINESS_PAGE_SIZE, businessStatuses } from './constants';
import { requirePlatformAdmin } from '@/modules/auth/authorization';
import type {
  Business,
  BusinessDetails,
  OwnerInvitation,
  OnboardingProgress,
  ActivityEvent,
} from './types';
export async function listBusinesses(search = '', status = '', page = 1) {
  const { supabase } = await requirePlatformAdmin();
  let query = supabase
    .from('tenants')
    .select('id,name,slug,status,template_key,created_at,plans(name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .order('id');
  const term = search.replace(/[%_\\]/g, '').slice(0, 100);
  if (term) query = query.ilike('name', `%${term}%`);
  if (businessStatuses.some((value) => value === status)) query = query.eq('status', status);
  const { data, count, error } = await query.range(
    (page - 1) * BUSINESS_PAGE_SIZE,
    page * BUSINESS_PAGE_SIZE - 1,
  );
  if (error) throw new Error('Businesses could not be loaded.');
  return { businesses: (data ?? []) as unknown as Business[], count: count ?? 0 };
}

/** Fetch the detail view in the data layer so the route only composes presentation. */
export async function getBusinessDetails(id: string): Promise<BusinessDetails | null> {
  const { supabase } = await requirePlatformAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await supabase
    .from('tenants')
    .select('id,name,slug,status,template_key,created_at,plans(name)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error('Business could not be loaded.');
  if (!data) return null;

  const [invitation, onboarding, activity] = await Promise.all([
    supabase
      .from('tenant_invitations')
      .select('id,owner_name,email,status')
      .eq('tenant_id', id)
      .maybeSingle(),
    supabase.from('tenant_onboarding').select('*').eq('tenant_id', id).maybeSingle(),
    supabase
      .from('audit_logs')
      .select('id,action,created_at')
      .eq('tenant_id', id)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);
  if (invitation.error || onboarding.error || activity.error)
    throw new Error('Business setup could not be loaded.');
  return {
    business: data as unknown as Business,
    invitation: invitation.data as OwnerInvitation | null,
    onboarding: onboarding.data as OnboardingProgress | null,
    activity: (activity.data ?? []) as ActivityEvent[],
  };
}

export async function getPlatformOverview() {
  const { supabase } = await requirePlatformAdmin();
  const { businesses, count } = await listBusinesses();
  const { count: pending, error } = await supabase
    .from('tenants')
    .select('id', { head: true, count: 'exact' })
    .eq('status', 'PROVISIONING');
  if (error) throw new Error('Platform totals could not be loaded.');
  return { businesses: businesses.slice(0, 5), count, pending: pending ?? 0 };
}
