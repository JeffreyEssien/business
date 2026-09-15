'use server';
import { revalidatePath } from 'next/cache';
import { requirePlatformAdmin } from '@/modules/auth/authorization';
import { getTenantWorkspace } from '@/modules/tenants/workspace-query';
import { SmsProviderError } from './provider';
import {
  dispatchQueuedSms,
  submitSenderRequestToTermii,
  synchronizeTermiiSenderIds,
} from './service';
import type { SmsSenderRequest, SmsSenderSubmission } from './types';

export type SmsActionState = { error: string; message: string };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function canManage(role: string) {
  return ['TENANT_OWNER', 'TENANT_ADMIN', 'TENANT_MANAGER'].includes(role);
}

function publicRequestError(message: string) {
  if (message.includes('SMS_NOT_INCLUDED'))
    return 'Text-message updates are not included in this business plan.';
  if (message.includes('SMS_SENDER_ALREADY_USED'))
    return 'That sender name is already assigned to another BusinessCare store.';
  if (message.includes('SMS_SENDER_REQUEST_UNAVAILABLE'))
    return 'This sender request is already being reviewed.';
  return 'The sender-name request could not be saved safely.';
}

export async function requestTenantSmsSender(
  slug: string,
  _state: SmsActionState,
  form: FormData,
): Promise<SmsActionState> {
  const workspace = await getTenantWorkspace(slug);
  if (!canManage(workspace.membership.role))
    return { error: 'You do not have permission to request an SMS sender name.', message: '' };
  const senderId = String(form.get('senderId') ?? '')
    .trim()
    .toUpperCase();
  const companyName = String(form.get('companyName') ?? '').trim();
  const useCase = String(form.get('useCase') ?? '').trim();
  if (!/^(?=.*[A-Z])[A-Z0-9 ]{3,11}$/.test(senderId))
    return { error: 'Use 3–11 letters or numbers and include at least one letter.', message: '' };
  if (companyName.length < 2 || companyName.length > 160)
    return { error: 'Enter the registered or trading name of this business.', message: '' };
  if (useCase.length < 10 || useCase.length > 320)
    return { error: 'Describe the order updates customers will receive.', message: '' };
  const { error } = await workspace.supabase.rpc('request_tenant_sms_sender', {
    target_tenant: workspace.tenant.id,
    sender_id: senderId,
    company_name: companyName,
    use_case: useCase,
  });
  if (error)
    return { error: publicRequestError(`${error.code ?? ''} ${error.message}`), message: '' };
  revalidatePath(`/t/${slug}/communications/sms`);
  revalidatePath('/sms-operations');
  return {
    error: '',
    message: 'Sender name submitted to BusinessCare for review. Text messages remain off for now.',
  };
}

export async function saveTenantSmsSettings(
  slug: string,
  _state: SmsActionState,
  form: FormData,
): Promise<SmsActionState> {
  const workspace = await getTenantWorkspace(slug);
  if (!canManage(workspace.membership.role))
    return { error: 'You do not have permission to change customer text messages.', message: '' };
  const enabled = form.get('enabled') === 'on';
  const { error } = await workspace.supabase.rpc('save_tenant_sms_settings', {
    target_tenant: workspace.tenant.id,
    sms_enabled: enabled,
    order_created: form.get('orderCreated') === 'on',
    payment_success: form.get('paymentSuccess') === 'on',
    order_ready: form.get('orderReady') === 'on',
    order_shipped: form.get('orderShipped') === 'on',
    order_delivered: form.get('orderDelivered') === 'on',
  });
  if (error) {
    const detail = `${error.code ?? ''} ${error.message}`;
    if (detail.includes('SMS_NOT_INCLUDED'))
      return { error: 'Text-message updates are not included in this business plan.', message: '' };
    if (detail.includes('SMS_SENDER_NOT_APPROVED'))
      return {
        error: 'Wait until the sender name is approved before turning messages on.',
        message: '',
      };
    return { error: 'Customer text-message choices could not be saved.', message: '' };
  }
  revalidatePath(`/t/${slug}/communications/sms`);
  return {
    error: '',
    message: enabled
      ? 'Automatic customer text-message choices saved.'
      : 'Automatic customer text messages are turned off.',
  };
}

export async function submitSmsSenderRequest(
  tenantId: string,
  _state: SmsActionState,
  _form: FormData,
): Promise<SmsActionState> {
  const { supabase } = await requirePlatformAdmin();
  if (!uuidPattern.test(tenantId)) return { error: 'This sender request is invalid.', message: '' };
  const { data, error } = await supabase.rpc('submit_sms_sender_request', {
    target_tenant: tenantId,
  });
  if (error || !data)
    return { error: 'This sender request is no longer ready for review.', message: '' };
  try {
    await submitSenderRequestToTermii(data as SmsSenderSubmission);
    revalidatePath('/sms-operations');
    return { error: '', message: 'Sender name submitted to Termii for network approval.' };
  } catch {
    revalidatePath('/sms-operations');
    return {
      error: 'Termii could not accept this request. It is marked for a safe retry.',
      message: '',
    };
  }
}

export async function rejectSmsSenderRequest(
  tenantId: string,
  _state: SmsActionState,
  _form: FormData,
): Promise<SmsActionState> {
  const { supabase } = await requirePlatformAdmin();
  if (!uuidPattern.test(tenantId)) return { error: 'This sender request is invalid.', message: '' };
  const { error } = await supabase.rpc('reject_sms_sender_request', {
    target_tenant: tenantId,
  });
  if (error) return { error: 'This sender request is no longer ready for review.', message: '' };
  revalidatePath('/sms-operations');
  return { error: '', message: 'Sender request returned to the business for correction.' };
}

export async function refreshSmsSenderStatuses(
  _state: SmsActionState,
  _form: FormData,
): Promise<SmsActionState> {
  const { supabase } = await requirePlatformAdmin();
  const { data, error } = await supabase.rpc('get_platform_sms_sender_requests', {
    result_limit: 100,
  });
  if (error) return { error: 'Sender requests could not be loaded.', message: '' };
  try {
    const updated = await synchronizeTermiiSenderIds((data ?? []) as SmsSenderRequest[]);
    revalidatePath('/sms-operations');
    return {
      error: '',
      message: updated
        ? `${updated} sender approval status ${updated === 1 ? 'was' : 'were'} updated.`
        : 'Sender approval statuses are already up to date.',
    };
  } catch {
    return { error: 'Termii sender approvals could not be refreshed.', message: '' };
  }
}

export async function processSmsQueue(
  _state: SmsActionState,
  _form: FormData,
): Promise<SmsActionState> {
  await requirePlatformAdmin();
  try {
    const result = await dispatchQueuedSms({ limit: 25 });
    revalidatePath('/sms-operations');
    return result.disabled
      ? { error: '', message: 'Delivery remains off until Termii is safely enabled.' }
      : {
          error: '',
          message: `${result.sent} of ${result.processed} queued text messages were accepted for delivery.`,
        };
  } catch {
    return { error: 'The text-message queue could not be processed safely.', message: '' };
  }
}

export async function retrySmsNotification(
  id: string,
  _state: SmsActionState,
  _form: FormData,
): Promise<SmsActionState> {
  const { supabase } = await requirePlatformAdmin();
  if (!uuidPattern.test(id)) return { error: 'This text-message record is invalid.', message: '' };
  const { error } = await supabase.rpc('retry_sms_notification', { target_notification: id });
  if (error) return { error: 'This text message is not available for retry.', message: '' };
  try {
    const result = await dispatchQueuedSms({ limit: 5 });
    revalidatePath('/sms-operations');
    return result.disabled
      ? { error: '', message: 'Text message queued. Delivery remains safely off.' }
      : { error: '', message: 'Text-message retry processed.' };
  } catch (error) {
    const code = error instanceof SmsProviderError ? error.code : '';
    return {
      error: '',
      message: code
        ? 'Text message queued and will be retried by the delivery job.'
        : 'Text message queued.',
    };
  }
}
