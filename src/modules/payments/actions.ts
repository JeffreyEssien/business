'use server';
import { revalidatePath } from 'next/cache';
import { requirePlatformAdmin } from '@/modules/auth/authorization';
import { processStoredPaystackWebhook, verifyAndApplyPaystackPayment } from './service';

export type PaymentOperationState = { error: string; message: string };

export async function retryPaymentReconciliation(
  paymentId: string,
  _state: PaymentOperationState,
): Promise<PaymentOperationState> {
  if (!/^[0-9a-f-]{36}$/i.test(paymentId))
    return { error: 'This payment record is not valid.', message: '' };
  const { supabase } = await requirePlatformAdmin();
  const { data, error } = await supabase
    .from('payments')
    .select('provider_reference,status')
    .eq('id', paymentId)
    .maybeSingle();
  if (error || !data) return { error: 'This payment record is no longer available.', message: '' };
  if (data.status === 'SUCCESS')
    return { error: 'This payment no longer needs reconciliation.', message: '' };
  try {
    const result = await verifyAndApplyPaystackPayment(data.provider_reference);
    revalidatePath('/payment-operations');
    if (['PROCESSED', 'ALREADY_PROCESSED'].includes(result))
      return { error: '', message: 'Paystack confirmed the payment and the order is now paid.' };
    if (result === 'DUPLICATE_PAYMENT_RECORDED')
      return {
        error: '',
        message: 'Paystack confirmed a duplicate receipt. It now requires a refund review.',
      };
    if (result === 'LATE_PAYMENT_RECORDED')
      return {
        error: '',
        message:
          'Paystack confirmed a late receipt. The cancelled order remains closed and a refund review is required.',
      };
    return { error: '', message: 'Paystack has not confirmed this payment yet.' };
  } catch {
    return {
      error: 'Paystack could not verify this payment. No order status was changed.',
      message: '',
    };
  }
}

export async function retryWebhookProcessing(
  eventId: string,
  _state: PaymentOperationState,
): Promise<PaymentOperationState> {
  if (!/^[0-9a-f-]{36}$/i.test(eventId))
    return { error: 'This webhook record is not valid.', message: '' };
  const { supabase } = await requirePlatformAdmin();
  const { data, error } = await supabase
    .from('payment_webhook_events')
    .select('event_key,processing_status')
    .eq('id', eventId)
    .maybeSingle();
  if (error || !data) return { error: 'This webhook record is no longer available.', message: '' };
  if (!['FAILED', 'RECEIVED'].includes(data.processing_status))
    return { error: 'This webhook does not need to be replayed.', message: '' };
  try {
    await processStoredPaystackWebhook(data.event_key, true);
    revalidatePath('/payment-operations');
    return { error: '', message: 'The stored webhook was processed again.' };
  } catch {
    return {
      error:
        'The webhook still could not be processed. Its receipt and failure state are preserved.',
      message: '',
    };
  }
}
