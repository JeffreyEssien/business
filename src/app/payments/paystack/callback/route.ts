import { NextResponse } from 'next/server';
import { logServerEvent } from '@/lib/observability/server';
import {
  applicationBaseUrl,
  getPaystackCallbackContext,
  verifyAndApplyPaystackPayment,
} from '@/modules/payments/service';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const reference = new URL(request.url).searchParams.get('reference') ?? '';
  const context = await getPaystackCallbackContext(reference);
  if (!context)
    return NextResponse.redirect(
      new URL('/payments/paystack/result?state=unavailable', applicationBaseUrl()),
    );
  try {
    await verifyAndApplyPaystackPayment(reference);
  } catch (error) {
    await logServerEvent({
      event: 'PAYSTACK_CALLBACK_VERIFICATION_PENDING',
      level: 'warning',
      operation: 'verify_callback',
      tenantId: context.tenantId,
      resourceType: 'payments',
      resourceId: context.paymentId,
      provider: 'paystack',
      success: false,
      errorCode: error instanceof Error ? error.name : 'PAYSTACK_VERIFICATION_FAILED',
    });
  }
  const result = new URL(`/store/${context.storeSlug}/checkout/payment`, applicationBaseUrl());
  result.searchParams.set('reference', context.orderReference);
  result.searchParams.set('token', context.accessToken);
  return NextResponse.redirect(result);
}
