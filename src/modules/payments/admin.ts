import 'server-only';
import { requirePlatformAdmin } from '@/modules/auth/authorization';
import type { PaymentOperation, WebhookOperation } from './types';

export async function getPaymentOperations() {
  const { supabase } = await requirePlatformAdmin();
  const paymentFields =
    'id,tenant_id,order_id,provider_reference,amount,currency,status,provider_status,order_application_status,resolution_status,settlement_subaccount_code,settlement_fee_bearer,platform_charge_subunit,failure_code,initiated_at';
  const [paymentResult, attentionResult, webhookResult] = await Promise.all([
    supabase
      .from('payments')
      .select(paymentFields)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('payments')
      .select(paymentFields)
      .neq('resolution_status', 'NONE')
      .order('paid_at', { ascending: false })
      .limit(50),
    supabase
      .from('payment_webhook_events')
      .select(
        'id,event_type,provider_reference,processing_status,error_code,received_at,attempts,next_retry_at',
      )
      .order('received_at', { ascending: false })
      .limit(25),
  ]);
  if (paymentResult.error || attentionResult.error || webhookResult.error)
    throw new Error('Payment operations could not be loaded.');
  const payments = paymentResult.data ?? [];
  const attention = attentionResult.data ?? [];
  const allPayments = [...payments, ...attention];
  const tenantIds = [...new Set(allPayments.map((payment) => payment.tenant_id))];
  const orderIds = [...new Set(allPayments.map((payment) => payment.order_id))];
  const [tenantResult, orderResult] = await Promise.all([
    tenantIds.length
      ? supabase.from('tenants').select('id,name').in('id', tenantIds)
      : Promise.resolve({ data: [], error: null }),
    orderIds.length
      ? supabase.from('orders').select('id,reference').in('id', orderIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (tenantResult.error || orderResult.error)
    throw new Error('Payment operation context could not be loaded.');
  const tenantNames = new Map((tenantResult.data ?? []).map((tenant) => [tenant.id, tenant.name]));
  const orderReferences = new Map(
    (orderResult.data ?? []).map((order) => [order.id, order.reference]),
  );
  const mapPayment = (payment: (typeof payments)[number]): PaymentOperation => ({
    id: payment.id,
    providerReference: payment.provider_reference,
    amount: Number(payment.amount),
    currency: payment.currency,
    status: payment.status,
    providerStatus: payment.provider_status,
    orderApplicationStatus: payment.order_application_status,
    resolutionStatus: payment.resolution_status,
    settlementAccount: payment.settlement_subaccount_code,
    settlementFeeBearer: payment.settlement_fee_bearer,
    platformChargeSubunit: payment.platform_charge_subunit,
    failureCode: payment.failure_code,
    initiatedAt: payment.initiated_at,
    tenantName: tenantNames.get(payment.tenant_id) ?? 'Unavailable business',
    orderReference: orderReferences.get(payment.order_id) ?? 'Unavailable order',
  });
  return {
    payments: payments.map(mapPayment),
    attention: attention.map(mapPayment),
    webhooks: (webhookResult.data ?? []).map((event): WebhookOperation => ({
      id: event.id,
      eventType: event.event_type,
      providerReference: event.provider_reference,
      processingStatus: event.processing_status,
      errorCode: event.error_code,
      receivedAt: event.received_at,
      attempts: event.attempts,
      nextRetryAt: event.next_retry_at,
    })),
  };
}
