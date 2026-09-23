import 'server-only';
import { requirePlatformAdmin } from '@/modules/auth/authorization';
import type { FeatureManagementData } from './types';

export async function getFeatureManagement(businessSearch = ''): Promise<FeatureManagementData> {
  const { supabase } = await requirePlatformAdmin();
  const search = businessSearch
    .replace(/[%_\\]/g, '')
    .trim()
    .slice(0, 100);
  let tenantQuery = supabase.from('tenants').select('id,name,slug').order('name').limit(50);
  if (search) tenantQuery = tenantQuery.ilike('name', `%${search}%`);
  const [features, plans, planValues, globalStates, overrides, tenants] = await Promise.all([
    supabase
      .from('features')
      .select('key,name,description,value_type,category,default_value')
      .eq('is_active', true)
      .order('category')
      .order('name'),
    supabase.from('plans').select('id,slug,name').order('name'),
    supabase.from('plan_features').select('plan_id,feature_key,value'),
    supabase.from('feature_global_state').select('feature_key,enabled,reason'),
    supabase
      .from('tenant_feature_overrides')
      .select('tenant_id,feature_key,value,reason,expires_at,tenant:tenants(name)'),
    tenantQuery,
  ]);
  if (
    features.error ||
    plans.error ||
    planValues.error ||
    globalStates.error ||
    overrides.error ||
    tenants.error
  )
    throw new Error('Feature controls could not be loaded.');
  const planOrder = new Map([
    ['starter', 0],
    ['growth', 1],
    ['pro', 2],
  ]);
  return {
    features: features.data ?? [],
    plans: [...(plans.data ?? [])].sort(
      (first, second) =>
        (planOrder.get(first.slug) ?? Number.MAX_SAFE_INTEGER) -
        (planOrder.get(second.slug) ?? Number.MAX_SAFE_INTEGER),
    ),
    planValues: planValues.data ?? [],
    globalStates: globalStates.data ?? [],
    overrides: overrides.data ?? [],
    tenants: tenants.data ?? [],
    businessSearch: search,
  } as FeatureManagementData;
}
