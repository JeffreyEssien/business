import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { logServerEvent } from '@/lib/observability/server';
import { emailDeliveryConfiguration, emailProvider, EmailProviderError } from './provider';
import { renderTransactionalEmail } from './templates';
import type { EmailNotificationContext } from './types';

async function deliverOne(id: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('get_email_notification_context', {
    target_notification: id,
  });
  if (error || !data) throw new EmailProviderError('EMAIL_CONTEXT_UNAVAILABLE');
  const context = data as EmailNotificationContext;
  try {
    const rendered = renderTransactionalEmail(context);
    const result = await emailProvider.send({
      to: context.recipientEmail,
      fromName: context.templateData.senderName,
      replyTo: context.templateData.replyTo,
      subject: context.subject,
      html: rendered.html,
      text: rendered.text,
      idempotencyKey: context.idempotencyKey,
      tags: [
        { name: 'event', value: context.eventType.toLowerCase() },
        { name: 'tenant', value: context.tenantId.replaceAll('-', '').slice(0, 32) },
      ],
    });
    const { error: completeError } = await admin.rpc('complete_email_notification', {
      target_notification: id,
      provider_id: result.providerMessageId,
    });
    if (completeError) throw new EmailProviderError('EMAIL_STATE_WRITE_FAILED');
    return true;
  } catch (caught) {
    const code = caught instanceof EmailProviderError ? caught.code : 'EMAIL_SEND_FAILED';
    await admin.rpc('fail_email_notification', {
      target_notification: id,
      failure_code: code,
    });
    await logServerEvent({
      event: 'transactional_email_delivery_failed',
      level: 'error',
      operation: 'deliver_transactional_email',
      tenantId: context.tenantId,
      resourceType: 'email_notification',
      resourceId: context.id,
      provider: 'resend',
      success: false,
      errorCode: code,
    });
    return false;
  }
}

export async function dispatchQueuedEmails({
  tenantId,
  limit = 10,
}: { tenantId?: string; limit?: number } = {}) {
  const configuration = emailDeliveryConfiguration();
  if (!configuration.configured || configuration.mode === 'disabled')
    return { processed: 0, sent: 0, disabled: true };
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('claim_email_notifications', {
    batch_size: Math.min(25, Math.max(1, limit)),
    target_tenant: tenantId ?? null,
  });
  if (error) throw new EmailProviderError('EMAIL_QUEUE_CLAIM_FAILED');
  const ids = ((data ?? []) as Array<{ notification_id: string }>).map(
    (row) => row.notification_id,
  );
  const results = await Promise.all(ids.map((id) => deliverOne(id)));
  return {
    processed: ids.length,
    sent: results.filter(Boolean).length,
    disabled: false,
  };
}

export async function queueOwnerInvitationEmail(invitationId: string, invitationUrl: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('queue_owner_invitation_email', {
    target_invitation: invitationId,
    invitation_url: invitationUrl,
  });
  if (error || typeof data !== 'string') throw new EmailProviderError('EMAIL_QUEUE_WRITE_FAILED');
  return data;
}

export async function recordResendWebhook(input: {
  eventId: string;
  eventType: string;
  providerMessageId: string;
  createdAt: string | null;
  errorCode: string;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('record_resend_webhook', {
    webhook_event_id: input.eventId,
    webhook_event_type: input.eventType,
    provider_id: input.providerMessageId,
    event_timestamp:
      input.createdAt && Number.isFinite(Date.parse(input.createdAt)) ? input.createdAt : null,
    error_reason: input.errorCode.slice(0, 100),
  });
  if (error) throw new EmailProviderError('EMAIL_WEBHOOK_WRITE_FAILED');
  return String(data ?? 'UNKNOWN');
}
