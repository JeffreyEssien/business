import 'server-only';
import { requirePlatformAdmin } from '@/modules/auth/authorization';
import type { PaymentOperation, WebhookOperation } from './types';

export async function getPaymentOperations() {
  const { supabase } = await requirePlatformAdmin();
  const [paymentResult, webhookResult] = await Promise.all([
    supabase
      .from('payments')
      .select(
        'id,tenant_id,order_id,provider_reference,amount,currency,status,failure_code,initiated_at',
      )
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('payment_webhook_events')
      .select('id,event_type,provider_reference,processing_status,error_code,received_at')
      .order('received_at', { ascending: false })
      .limit(25),
  ]);
  if (paymentResult.error || webhookResult.error)
    throw new Error('Payment operations could not be loaded.');
  const payments = paymentResult.data ?? [];
  const tenantIds = [...new Set(payments.map((payment) => payment.tenant_id))];
  const orderIds = [...new Set(payments.map((payment) => payment.order_id))];
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
  return {
    payments: payments.map((payment): PaymentOperation => ({
      id: payment.id,
      providerReference: payment.provider_reference,
      amount: Number(payment.amount),
      currency: payment.currency,
      status: payment.status,
      failureCode: payment.failure_code,
      initiatedAt: payment.initiated_at,
      tenantName: tenantNames.get(payment.tenant_id) ?? 'Unavailable business',
      orderReference: orderReferences.get(payment.order_id) ?? 'Unavailable order',
    })),
    webhooks: (webhookResult.data ?? []).map((event): WebhookOperation => ({
      id: event.id,
      eventType: event.event_type,
      providerReference: event.provider_reference,
      processingStatus: event.processing_status,
      errorCode: event.error_code,
      receivedAt: event.received_at,
    })),
  };
}
