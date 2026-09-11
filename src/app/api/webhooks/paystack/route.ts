import { logServerEvent } from '@/lib/observability/server';
import { PaymentProviderError, verifyPaystackSignature } from '@/modules/payments/paystack';
import { processPaystackWebhookPayload } from '@/modules/payments/service';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > 256 * 1024) return new Response('Payload too large', { status: 413 });
  const rawBody = await request.text();
  if (rawBody.length > 256 * 1024) return new Response('Payload too large', { status: 413 });
  let verified = false;
  try {
    verified = verifyPaystackSignature(rawBody, request.headers.get('x-paystack-signature'));
  } catch (error) {
    if (!(error instanceof PaymentProviderError)) throw error;
  }
  if (!verified) return new Response('Invalid signature', { status: 401 });
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid payload', { status: 400 });
  }
  try {
    await processPaystackWebhookPayload(payload);
    await logServerEvent({
      event: 'PAYSTACK_WEBHOOK_PROCESSED',
      operation: 'process_webhook',
      provider: 'paystack',
      success: true,
    });
    return Response.json({ received: true });
  } catch (error) {
    const errorCode =
      error instanceof PaymentProviderError ? error.code : 'WEBHOOK_PROCESSING_FAILED';
    await logServerEvent({
      event: 'PAYSTACK_WEBHOOK_FAILED',
      level: 'error',
      operation: 'process_webhook',
      provider: 'paystack',
      success: false,
      errorCode,
    });
    return new Response('Processing failed', { status: 500 });
  }
}
