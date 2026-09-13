import { createHash } from 'node:crypto';
import { logServerEvent } from '@/lib/observability/server';
import { verifyTermiiSignature } from '@/modules/sms/provider';
import { recordTermiiWebhook } from '@/modules/sms/service';

export const runtime = 'nodejs';

function text(value: unknown, limit: number) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > 64 * 1024)
    return new Response('Webhook too large', { status: 413 });
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody) > 64 * 1024)
    return new Response('Webhook too large', { status: 413 });
  if (!verifyTermiiSignature(rawBody, request.headers.get('x-termii-signature'))) {
    await logServerEvent({
      event: 'termii_webhook_rejected',
      level: 'warning',
      operation: 'verify_termii_webhook',
      provider: 'termii',
      success: false,
      errorCode: 'INVALID_SIGNATURE',
    });
    return new Response('Invalid signature', { status: 401 });
  }
  let payload: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    payload = parsed as Record<string, unknown>;
  } catch {
    return new Response('Invalid payload', { status: 400 });
  }
  const messageId = text(payload.message_id, 200);
  const status = text(payload.status, 100);
  const providerEventId = text(payload.id, 200);
  const channel = text(payload.channel, 40);
  const sentAt = text(payload.sent_at, 80) || null;
  const parsedCost =
    payload.cost === null || payload.cost === undefined ? null : Number(payload.cost);
  if (
    !messageId ||
    !status ||
    (parsedCost !== null && (!Number.isFinite(parsedCost) || parsedCost < 0))
  )
    return new Response('Invalid payload', { status: 400 });
  const eventKey = providerEventId
    ? `${providerEventId}:${status}`.slice(0, 300)
    : createHash('sha256')
        .update(`${messageId}:${status}:${sentAt ?? ''}`)
        .digest('hex');
  try {
    await recordTermiiWebhook({
      eventKey,
      messageId,
      status,
      sentAt,
      cost: parsedCost,
      channel,
    });
    return new Response('ok');
  } catch (error) {
    await logServerEvent({
      event: 'termii_webhook_storage_failed',
      level: 'error',
      operation: 'store_termii_webhook',
      provider: 'termii',
      success: false,
      errorCode: error instanceof Error ? error.name : 'SMS_WEBHOOK_WRITE_FAILED',
    });
    return new Response('Webhook storage unavailable', { status: 503 });
  }
}
