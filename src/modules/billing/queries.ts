import 'server-only';
import { requirePlatformAdmin } from '@/modules/auth/authorization';
import type { Plan, PlanManagementData } from './types';

export async function getPlanManagement(): Promise<PlanManagementData> {
  const { supabase } = await requirePlatformAdmin();
  const { data, error } = await supabase
    .from('plans')
    .select(
      'id,slug,name,description,price,currency,billing_interval,is_public,sort_order,is_active',
    )
    .order('sort_order')
    .order('name');
  if (error) throw new Error('Plans could not be loaded.');
  // PostgREST may surface numeric columns as strings; coerce once so the typed
  // contract holds for every consumer and formatMoney receives a real number.
  const plans: Plan[] = (data ?? []).map((plan) => ({
    ...plan,
    price: Number(plan.price),
    sort_order: Number(plan.sort_order),
  })) as Plan[];
  return { plans };
}
