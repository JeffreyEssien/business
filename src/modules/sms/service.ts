import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { logServerEvent } from '@/lib/observability/server';
import { smsDeliveryConfiguration, smsProvider, SmsProviderError } from './provider';
import type { SmsNotificationContext, SmsSenderSubmission } from './types';

async function deliverOne(id: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('get_sms_notification_context', {
    target_notification: id,
  });
  if (error || !data) throw new SmsProviderError('SMS_CONTEXT_UNAVAILABLE');
  const context = data as SmsNotificationContext;
  try {
    const result = await smsProvider.send({
      to: context.recipientPhone,
      senderId: context.senderId,
      message: context.message,
      idempotencyKey: context.idempotencyKey,
    });
    const { error: completeError } = await admin.rpc('complete_sms_notification', {
      target_notification: id,
      provider_id: result.providerMessageId,
    });
    if (completeError) throw new SmsProviderError('SMS_STATE_WRITE_FAILED', false, true);
    return true;
  } catch (caught) {
    const failure =
      caught instanceof SmsProviderError
        ? caught
        : new SmsProviderError('SMS_SEND_UNKNOWN', false, true);
    await admin.rpc('fail_sms_notification', {
      target_notification: id,
      failure_code: failure.code,
      retryable: failure.retryable,
      delivery_unknown: failure.deliveryUnknown,
    });
    await logServerEvent({
      event: 'transactional_sms_delivery_failed',
      level: 'error',
      operation: 'deliver_transactional_sms',
      tenantId: context.tenantId,
      resourceType: 'sms_notification',
      resourceId: context.id,
      provider: 'termii',
      success: false,
      errorCode: failure.code,
    });
    return false;
  }
}

export async function dispatchQueuedSms({
  tenantId,
  limit = 10,
}: { tenantId?: string; limit?: number } = {}) {
  const configuration = smsDeliveryConfiguration();
  if (!configuration.configured || configuration.mode === 'disabled')
    return { processed: 0, sent: 0, disabled: true };
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('claim_sms_notifications', {
    batch_size: Math.min(25, Math.max(1, limit)),
    target_tenant: tenantId ?? null,
  });
  if (error) throw new SmsProviderError('SMS_QUEUE_CLAIM_FAILED');
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

export async function submitSenderRequestToTermii(submission: SmsSenderSubmission) {
  const admin = createAdminClient();
  try {
    await smsProvider.requestSenderId({
      senderId: submission.senderId,
      companyName: submission.companyName,
      useCase: submission.useCase,
    });
  } catch (caught) {
    const code = caught instanceof SmsProviderError ? caught.code : 'TERMII_SENDER_REQUEST_FAILED';
    await admin.rpc('record_sms_sender_request_failure', {
      target_tenant: submission.tenantId,
      failure_code: code,
    });
    throw caught;
  }
}

export async function synchronizeTermiiSenderIds(
  requests: Array<{ tenant_id: string; requested_sender_id: string; sender_id_status: string }>,
) {
  const providerSenders = await smsProvider.listSenderIds();
  const admin = createAdminClient();
  const providerByName = new Map(providerSenders.map((item) => [item.senderId, item.status]));
  const changes = requests.flatMap((request) => {
    const status = providerByName.get(request.requested_sender_id.toUpperCase());
    if (!status || status === request.sender_id_status) return [];
    return [{ tenantId: request.tenant_id, status }];
  });
  const results = await Promise.all(
    changes.map(({ tenantId, status }) =>
      admin.rpc('sync_sms_sender_status', {
        target_tenant: tenantId,
        provider_status: status,
        status_message: '',
      }),
    ),
  );
  if (results.some(({ error }) => error))
    throw new SmsProviderError('SMS_SENDER_STATUS_WRITE_FAILED');
  return changes.length;
}

export async function recordTermiiWebhook(input: {
  eventKey: string;
  messageId: string;
  status: string;
  sentAt: string | null;
  cost: number | null;
  channel: string;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('record_termii_sms_webhook', {
    webhook_event_key: input.eventKey,
    provider_id: input.messageId,
    delivery_state: input.status,
    event_timestamp:
      input.sentAt && Number.isFinite(Date.parse(input.sentAt)) ? input.sentAt : null,
    delivery_cost: input.cost,
    delivery_channel: input.channel.slice(0, 40),
  });
  if (error) throw new SmsProviderError('SMS_WEBHOOK_WRITE_FAILED');
  return String(data ?? 'UNKNOWN');
}
