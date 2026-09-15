'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requirePlatformAdmin } from '@/modules/auth/authorization';

export type EntitlementActionState = { error: string; message: string };

function featureValue(form: FormData) {
  const type = String(form.get('valueType') ?? '');
  const raw = String(form.get('value') ?? '').trim();
  if (type === 'BOOLEAN') return raw === 'true';
  if (type === 'INTEGER') {
    if (raw === '') return null;
    if (!/^\d{1,7}$/.test(raw)) throw new Error('Enter a whole number or leave it empty.');
    return Number(raw);
  }
  if (type === 'STRING') return raw;
  throw new Error('This feature value cannot be edited here yet.');
}

export async function savePlanFeature(
  _state: EntitlementActionState,
  form: FormData,
): Promise<EntitlementActionState> {
  const { supabase } = await requirePlatformAdmin();
  let value;
  try {
    value = featureValue(form);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Enter a valid value.', message: '' };
  }
  const { error } = await supabase.rpc('save_plan_feature', {
    target_plan: String(form.get('plan') ?? ''),
    target_feature: String(form.get('feature') ?? ''),
    new_value: value ?? 0,
    value_is_unlimited: value === null,
  });
  if (error) return { error: 'The plan value could not be saved.', message: '' };
  revalidatePath('/features');
  return { error: '', message: 'Plan value saved.' };
}

export async function saveFeatureGlobalState(
  _state: EntitlementActionState,
  form: FormData,
): Promise<EntitlementActionState> {
  const { supabase } = await requirePlatformAdmin();
  const enabled = String(form.get('enabled')) === 'true';
  const { error } = await supabase.rpc('set_feature_global_state', {
    target_feature: String(form.get('feature') ?? ''),
    is_enabled: enabled,
    state_reason: String(form.get('reason') ?? ''),
  });
  if (error)
    return {
      error: enabled ? 'The feature could not be restored.' : 'Add a clear shutdown reason.',
      message: '',
    };
  revalidatePath('/features');
  return { error: '', message: enabled ? 'Feature restored.' : 'Feature paused globally.' };
}

export async function saveTenantOverride(
  _state: EntitlementActionState,
  form: FormData,
): Promise<EntitlementActionState> {
  const { supabase } = await requirePlatformAdmin();
  let value;
  try {
    value = featureValue(form);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Enter a valid value.', message: '' };
  }
  const expires = String(form.get('expiresAt') ?? '').trim();
  const expiresAt = expires ? new Date(expires) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime()))
    return { error: 'Choose a valid expiry date and time.', message: '' };
  const { error } = await supabase.rpc('save_tenant_feature_override', {
    target_tenant: String(form.get('tenant') ?? ''),
    target_feature: String(form.get('feature') ?? ''),
    new_value: value ?? 0,
    override_reason: String(form.get('reason') ?? ''),
    override_expires_at: expiresAt?.toISOString() ?? null,
    value_is_unlimited: value === null,
  });
  if (error)
    return { error: 'The override could not be saved. Check its value and expiry.', message: '' };
  revalidatePath('/features');
  return { error: '', message: 'Business override saved.' };
}

export async function removeTenantOverride(
  _state: EntitlementActionState,
  form: FormData,
): Promise<EntitlementActionState> {
  const { supabase } = await requirePlatformAdmin();
  const { error } = await supabase.rpc('delete_tenant_feature_override', {
    target_tenant: String(form.get('tenant') ?? ''),
    target_feature: String(form.get('feature') ?? ''),
  });
  if (error) return { error: 'The override could not be removed.', message: '' };
  revalidatePath('/features');
  const search = String(form.get('businessSearch') ?? '').slice(0, 100);
  const query = new URLSearchParams({ notice: 'override-removed' });
  if (search) query.set('business', search);
  redirect(`/features?${query}`);
}
