import 'server-only';
import { requirePlatformAdmin } from '@/modules/auth/authorization';
import { getTenantWorkspace } from '@/modules/tenants/workspace-query';
import { emailDeliveryConfiguration } from './provider';
import type { EmailLog, EmailSettings } from './types';

export async function getTenantEmailWorkspace(slug: string) {
  const workspace = await getTenantWorkspace(slug);
  const [settingsResult, logsResult, businessResult, themeResult] = await Promise.all([
    workspace.supabase
      .from('tenant_email_settings')
      .select(
        'enabled,from_name,from_email,reply_to,custom_domain_status,order_created_enabled,payment_success_enabled,order_ready_enabled,order_shipped_enabled,order_delivered_enabled,marketing_enabled,updated_at',
      )
      .eq('tenant_id', workspace.tenant.id)
      .single(),
    workspace.supabase.rpc('get_tenant_email_logs', {
      target_tenant: workspace.tenant.id,
      result_limit: 30,
    }),
    workspace.supabase
      .from('tenant_business_settings')
      .select('business_name,contact_email')
      .eq('tenant_id', workspace.tenant.id)
      .single(),
    workspace.supabase
      .from('tenant_theme_settings')
      .select('tokens')
      .eq('tenant_id', workspace.tenant.id)
      .single(),
  ]);
  if (settingsResult.error || logsResult.error || businessResult.error || themeResult.error)
    throw new Error('Customer email settings could not be loaded.');
  const delivery = emailDeliveryConfiguration();
  return {
    ...workspace,
    settings: settingsResult.data as EmailSettings,
    logs: (logsResult.data ?? []) as EmailLog[],
    business: businessResult.data,
    primaryColor: String(themeResult.data.tokens?.primary ?? '#6655d7'),
    delivery: {
      mode: delivery.mode,
      configured: delivery.configured,
      fromName: delivery.fromName,
      fromAddress: delivery.fromAddress,
    },
  };
}

export async function getPlatformEmailOperations() {
  const { supabase } = await requirePlatformAdmin();
  const { data, error } = await supabase.rpc('get_platform_email_logs', { result_limit: 75 });
  if (error) throw new Error('Email operations could not be loaded.');
  return {
    logs: (data ?? []) as EmailLog[],
    delivery: emailDeliveryConfiguration(),
  };
}
