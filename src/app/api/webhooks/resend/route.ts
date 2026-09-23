import { Resend } from 'resend';
import { logServerEvent } from '@/lib/observability/server';
import { recordResendWebhook } from '@/modules/email/service';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const eventId = request.headers.get('svix-id') ?? '';
  const timestamp = request.headers.get('svix-timestamp') ?? '';
  const signature = request.headers.get('svix-signature') ?? '';
  const secret = process.env.RESEND_WEBHOOK_SECRET ?? '';
  if (!eventId || !timestamp || !signature || !secret)
    return new Response('Invalid webhook', { status: 400 });
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > 256 * 1024)
    return new Response('Webhook too large', { status: 413 });
  const payload = await request.text();
  if (Buffer.byteLength(payload) > 256 * 1024)
    return new Response('Webhook too large', { status: 413 });
  let event: ReturnType<Resend['webhooks']['verify']>;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    event = resend.webhooks.verify({
      payload,
      headers: { id: eventId, timestamp, signature },
      webhookSecret: secret,
    });
  } catch (error) {
    await logServerEvent({
      event: 'resend_webhook_rejected',
      level: 'warning',
      operation: 'verify_resend_webhook',
      provider: 'resend',
      success: false,
      errorCode: error instanceof Error ? error.name : 'INVALID_WEBHOOK',
    });
    return new Response('Invalid webhook', { status: 400 });
  }
  const data = event.data as unknown as Record<string, unknown>;
  const providerMessageId = typeof data.email_id === 'string' ? data.email_id : '';
  if (!providerMessageId || providerMessageId.length > 200)
    return new Response('Invalid webhook', { status: 400 });
  const failure = data.failed as Record<string, unknown> | undefined;
  const bounce = data.bounce as Record<string, unknown> | undefined;
  const errorCode =
    (typeof failure?.reason === 'string' && failure.reason) ||
    (typeof bounce?.subType === 'string' && bounce.subType) ||
    (typeof bounce?.type === 'string' && bounce.type) ||
    '';
  try {
    await recordResendWebhook({
      eventId,
      eventType: event.type,
      providerMessageId,
      createdAt: typeof event.created_at === 'string' ? event.created_at : null,
      errorCode,
    });
    return new Response('ok');
  } catch (error) {
    await logServerEvent({
      event: 'resend_webhook_storage_failed',
      level: 'error',
      operation: 'store_resend_webhook',
      provider: 'resend',
      success: false,
      errorCode: error instanceof Error ? error.name : 'EMAIL_WEBHOOK_WRITE_FAILED',
    });
    return new Response('Webhook storage unavailable', { status: 503 });
  }
}
