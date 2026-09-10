import 'server-only';
import { requirePlatformAdmin } from '@/modules/auth/authorization';
import { applicationStatusOptions } from './options';
import type { ApplicationEvent, ApplicationRevision, BusinessApplication } from './types';

export const APPLICATION_PAGE_SIZE = 20;

export async function listApplications(search = '', status = '', page = 1) {
  const { supabase } = await requirePlatformAdmin();
  let query = supabase
    .from('business_applications')
    .select(
      'id,reference,status,business_name,business_type,owner_name,owner_email,proposed_plan,submitted_at',
      { count: 'exact' },
    )
    .order('submitted_at', { ascending: false })
    .order('id')
    .range((page - 1) * APPLICATION_PAGE_SIZE, page * APPLICATION_PAGE_SIZE - 1);
  const term = search
    .replace(/[%_\\]/g, '')
    .trim()
    .slice(0, 100);
  if (term)
    query = query.or(
      `business_name.ilike.%${term}%,owner_name.ilike.%${term}%,owner_email.ilike.%${term}%,reference.ilike.%${term}%`,
    );
  if (applicationStatusOptions.some((option) => option.value === status) && status)
    query = query.eq('status', status);
  const { data, count, error } = await query;
  if (error) throw new Error('Business applications could not be loaded.');
  return { applications: (data ?? []) as BusinessApplication[], count: count ?? 0 };
}

export async function getApplication(id: string) {
  const { supabase } = await requirePlatformAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const applicationResult = await supabase
    .from('business_applications')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (applicationResult.error) throw new Error('The application could not be loaded.');
  if (!applicationResult.data) return null;
  const [events, revisions] = await Promise.all([
    supabase
      .from('business_application_events')
      .select('id,action,created_at')
      .eq('application_id', id)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('business_application_revisions')
      .select('id,previous_values,created_at')
      .eq('application_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);
  if (events.error || revisions.error)
    throw new Error('The application history could not be loaded.');
  return {
    application: applicationResult.data as BusinessApplication,
    events: (events.data ?? []) as ApplicationEvent[],
    revisions: (revisions.data ?? []) as ApplicationRevision[],
  };
}
