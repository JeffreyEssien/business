'use server';

import { revalidatePath } from 'next/cache';
import { requirePlatformAdmin } from '@/modules/auth/authorization';
import { normalizePlanInput } from './validation';

export type PlanActionState = { error: string; message: string };

export async function savePlan(_state: PlanActionState, form: FormData): Promise<PlanActionState> {
  const { supabase } = await requirePlatformAdmin();
  const { input, error } = normalizePlanInput(form);
  if (!input) return { error: error ?? 'Check the plan details.', message: '' };
  const { error: rpcError } = await supabase.rpc('save_plan', {
    target_plan: input.slug,
    plan_name: input.name,
    plan_description: input.description,
    plan_price: input.price,
    plan_currency: input.currency,
    plan_billing_interval: input.billingInterval,
    plan_is_public: input.isPublic,
    plan_sort_order: input.sortOrder,
  });
  if (rpcError) return { error: 'This plan could not be saved.', message: '' };
  revalidatePath('/billing/plans');
  return { error: '', message: 'Plan saved.' };
}
