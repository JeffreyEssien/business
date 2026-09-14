import 'server-only';
import { requirePlatformAdmin } from '@/modules/auth/authorization';
import { getTenantWorkspace } from '@/modules/tenants/workspace-query';
import { smsDeliveryConfiguration } from './provider';
import type { SmsLog, SmsSenderRequest, SmsSettings } from './types';

const settingsColumns =
  'enabled,requested_sender_id,approved_sender_id,sender_id_status,sender_company_name,sender_use_case,sender_status_message,order_created_enabled,payment_success_enabled,order_ready_enabled,order_shipped_enabled,order_delivered_enabled,marketing_enabled,sender_requested_at,sender_approved_at,updated_at';

export async function getTenantSmsWorkspace(slug: string) {
  const workspace = await getTenantWorkspace(slug);
  const [settingsResult, logsResult, businessResult, entitlementResult] = await Promise.all([
    workspace.supabase
      .from('tenant_sms_settings')
      .select(settingsColumns)
      .eq('tenant_id', workspace.tenant.id)
      .single(),
    workspace.supabase.rpc('get_tenant_sms_logs', {
      target_tenant: workspace.tenant.id,
      result_limit: 30,
    }),
    workspace.supabase
      .from('tenant_business_settings')
      .select('business_name')
      .eq('tenant_id', workspace.tenant.id)
      .single(),
    workspace.supabase.rpc('get_tenant_entitlements', {
      target_tenant: workspace.tenant.id,
    }),
  ]);
  if (settingsResult.error || logsResult.error || businessResult.error || entitlementResult.error)
    throw new Error('Customer text-message settings could not be loaded.');
  const delivery = smsDeliveryConfiguration();
  return {
    ...workspace,
    settings: settingsResult.data as SmsSettings,
    logs: (logsResult.data ?? []) as SmsLog[],
    businessName: businessResult.data.business_name,
    entitled:
      Boolean(entitlementResult.data) &&
      (entitlementResult.data as Record<string, unknown>).sms_notifications === true,
    delivery: { mode: delivery.mode, configured: delivery.configured },
  };
}

export async function getPlatformSmsOperations() {
  const { supabase } = await requirePlatformAdmin();
  const [logsResult, requestsResult] = await Promise.all([
    supabase.rpc('get_platform_sms_logs', { result_limit: 75 }),
    supabase.rpc('get_platform_sms_sender_requests', { result_limit: 75 }),
  ]);
  if (logsResult.error || requestsResult.error)
    throw new Error('Text-message operations could not be loaded.');
  return {
    logs: (logsResult.data ?? []) as SmsLog[],
    requests: (requestsResult.data ?? []) as SmsSenderRequest[],
    delivery: smsDeliveryConfiguration(),
  };
}
