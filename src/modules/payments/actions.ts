'use server';
import { revalidatePath } from 'next/cache';
import { requirePlatformAdmin } from '@/modules/auth/authorization';
import { verifyAndApplyPaystackPayment } from './service';

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
  if (data.status === 'SUCCESS' || data.status === 'CANCELLED')
    return { error: 'This payment no longer needs reconciliation.', message: '' };
  try {
    const result = await verifyAndApplyPaystackPayment(data.provider_reference);
    revalidatePath('/payment-operations');
    return ['PROCESSED', 'ALREADY_PROCESSED'].includes(result)
      ? { error: '', message: 'Paystack confirmed the payment and the order is now paid.' }
      : { error: '', message: 'Paystack has not confirmed this payment.' };
  } catch {
    return {
      error: 'Paystack could not verify this payment. No order status was changed.',
      message: '',
    };
  }
}
