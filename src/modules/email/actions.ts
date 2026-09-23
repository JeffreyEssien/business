'use server';
import { revalidatePath } from 'next/cache';
import { requirePlatformAdmin } from '@/modules/auth/authorization';
import { getTenantWorkspace } from '@/modules/tenants/workspace-query';
import { dispatchQueuedEmails } from './service';

export type EmailActionState = { error: string; message: string };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function saveTenantEmailSettings(
  slug: string,
  _state: EmailActionState,
  form: FormData,
): Promise<EmailActionState> {
  const workspace = await getTenantWorkspace(slug);
  if (!['TENANT_OWNER', 'TENANT_ADMIN', 'TENANT_MANAGER'].includes(workspace.membership.role))
    return { error: 'You do not have permission to change customer emails.', message: '' };
  const fromName = String(form.get('fromName') ?? '').trim();
  const replyTo = String(form.get('replyTo') ?? '')
    .trim()
    .toLowerCase();
  if (fromName.length > 100)
    return { error: 'The sender name must be 100 characters or fewer.', message: '' };
  if (replyTo && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo) || replyTo.length > 254))
    return { error: 'Enter a valid reply-to email address.', message: '' };
  const { error } = await workspace.supabase.rpc('save_tenant_email_settings', {
    target_tenant: workspace.tenant.id,
    email_enabled: form.get('enabled') === 'on',
    sender_name: fromName,
    reply_address: replyTo,
    order_created: form.get('orderCreated') === 'on',
    payment_success: form.get('paymentSuccess') === 'on',
    order_ready: form.get('orderReady') === 'on',
    order_shipped: form.get('orderShipped') === 'on',
    order_delivered: form.get('orderDelivered') === 'on',
  });
  if (error) return { error: 'Customer email settings could not be saved.', message: '' };
  revalidatePath(`/t/${slug}/communications/email`);
  return {
    error: '',
    message:
      form.get('enabled') === 'on'
        ? 'Automatic customer email choices saved.'
        : 'Automatic customer emails are turned off.',
  };
}

export async function processEmailQueue(
  _state: EmailActionState,
  _form: FormData,
): Promise<EmailActionState> {
  await requirePlatformAdmin();
  try {
    const result = await dispatchQueuedEmails({ limit: 25 });
    revalidatePath('/communications');
    return result.disabled
      ? { error: '', message: 'Delivery is disabled until the Resend settings are configured.' }
      : {
          error: '',
          message: `${result.sent} of ${result.processed} queued emails were accepted for delivery.`,
        };
  } catch {
    return { error: 'The email queue could not be processed safely.', message: '' };
  }
}

export async function retryEmailNotification(
  id: string,
  _state: EmailActionState,
  _form: FormData,
): Promise<EmailActionState> {
  const { supabase } = await requirePlatformAdmin();
  if (!uuidPattern.test(id)) return { error: 'This email record is invalid.', message: '' };
  const { error } = await supabase.rpc('retry_email_notification', { target_notification: id });
  if (error) return { error: 'This email is not available for retry.', message: '' };
  try {
    const result = await dispatchQueuedEmails({ limit: 5 });
    revalidatePath('/communications');
    return result.disabled
      ? {
          error: '',
          message: 'Email queued. Delivery remains disabled until Resend is configured.',
        }
      : { error: '', message: 'Email retry processed.' };
  } catch {
    return { error: '', message: 'Email queued and will be retried by the delivery job.' };
  }
}
