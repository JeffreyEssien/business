import { logServerEvent } from '@/lib/observability/server';
import { recordEmailWebhook } from '@/modules/email/service';
import { verifyZeptoMailWebhook, zeptoMailWebhookEvent } from '@/modules/email/zeptomail';

export const runtime = 'nodejs';

const MAX_WEBHOOK_BYTES = 256 * 1024;

/**
 * ZeptoMail delivery events (bounces, complaints, deliveries). Requests are
 * accepted only with a valid `producer-signature` HMAC made with the Agent's
 * webhook Authentication Key (ZEPTOMAIL_WEBHOOK_SECRET) and a fresh timestamp.
 */
export async function POST(request: Request) {
  const signatureHeader = request.headers.get('producer-signature') ?? '';
  const secret = process.env.ZEPTOMAIL_WEBHOOK_SECRET ?? '';
  if (!signatureHeader || !secret) return new Response('Invalid webhook', { status: 400 });
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BYTES)
    return new Response('Webhook too large', { status: 413 });
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody) > MAX_WEBHOOK_BYTES)
    return new Response('Webhook too large', { status: 413 });

  const signedPayload = verifyZeptoMailWebhook({ rawBody, signatureHeader, secret });
  let payload: unknown = null;
  try {
    payload = signedPayload === null ? null : JSON.parse(signedPayload);
  } catch {
    payload = null;
  }
  if (payload === null) {
    await logServerEvent({
      event: 'zeptomail_webhook_rejected',
      level: 'warning',
      operation: 'verify_zeptomail_webhook',
      provider: 'zeptomail',
      success: false,
      errorCode: signedPayload === null ? 'INVALID_SIGNATURE' : 'INVALID_PAYLOAD',
    });
    return new Response('Invalid webhook', { status: 400 });
  }

  const event = zeptoMailWebhookEvent(payload);
  // Opens, clicks, and unknown events are acknowledged so ZeptoMail stops retrying.
  if (!event) return new Response('ignored');
  try {
    await recordEmailWebhook(event);
    return new Response('ok');
  } catch (error) {
    await logServerEvent({
      event: 'zeptomail_webhook_storage_failed',
      level: 'error',
      operation: 'store_zeptomail_webhook',
      provider: 'zeptomail',
      success: false,
      errorCode: error instanceof Error ? error.name : 'EMAIL_WEBHOOK_WRITE_FAILED',
    });
    return new Response('Webhook storage unavailable', { status: 503 });
  }
}
