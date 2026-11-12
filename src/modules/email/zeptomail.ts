// ZeptoMail (Zoho) transactional email: request building, response parsing,
// webhook signature checks, and event mapping. Kept free of `server-only` and
// network calls so unit tests exercise the exact code the provider uses.
import { createHmac, timingSafeEqual } from 'node:crypto';

export const ZEPTOMAIL_DEFAULT_API_URL = 'https://api.zeptomail.com/v1.1/email';

/** Webhook timestamps older or newer than this are rejected as replays. */
export const ZEPTOMAIL_WEBHOOK_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * Accepts only HTTPS ZeptoMail or Zoho hosts so a misconfigured environment
 * value can never send the API key and customer email to another service.
 * Region hosts differ (for example api.zeptomail.eu or api.zeptomail.in).
 */
export function zeptoMailApiUrl(raw: string | undefined) {
  const value = String(raw ?? '').trim() || ZEPTOMAIL_DEFAULT_API_URL;
  try {
    const url = new URL(value);
    const trustedHost = /(^|\.)(zeptomail|zoho)\.[a-z]{2,3}(\.[a-z]{2})?$/.test(url.hostname);
    if (url.protocol !== 'https:' || !trustedHost || url.username || url.password) return '';
    return url.toString();
  } catch {
    return '';
  }
}

/** ZeptoMail tokens are pasted with or without the "Zoho-enczapikey" prefix. */
export function zeptoMailAuthorization(token: string | undefined) {
  const value = String(token ?? '').trim();
  if (!value) return '';
  return value.toLowerCase().startsWith('zoho-enczapikey ') ? value : `Zoho-enczapikey ${value}`;
}

export type ZeptoMailMessage = {
  fromAddress: string;
  fromName: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  clientReference: string;
};

export function zeptoMailRequestBody(message: ZeptoMailMessage) {
  return {
    from: { address: message.fromAddress, name: message.fromName },
    to: [{ email_address: { address: message.to } }],
    ...(message.replyTo ? { reply_to: [{ address: message.replyTo }] } : {}),
    subject: message.subject,
    htmlbody: message.html,
    textbody: message.text,
    // Our idempotency key, echoed back in webhooks and searchable in the
    // ZeptoMail console. ZeptoMail has no provider-side duplicate protection.
    client_reference: message.clientReference.slice(0, 200),
    track_opens: false,
    track_clicks: false,
  };
}

/** Returns the ZeptoMail request id that later webhooks refer to. */
export function zeptoMailRequestId(status: number, body: unknown) {
  if (status < 200 || status >= 300 || !body || typeof body !== 'object') return '';
  const requestId = (body as Record<string, unknown>).request_id;
  return typeof requestId === 'string' && requestId.length >= 1 && requestId.length <= 200
    ? requestId
    : '';
}

/** Stable, bounded error code for logs; never includes provider message text. */
export function zeptoMailErrorCode(status: number, body: unknown) {
  if (status === 401 || status === 403) return 'ZEPTOMAIL_UNAUTHORIZED';
  if (status === 429) return 'ZEPTOMAIL_RATE_LIMITED';
  const data =
    body && typeof body === 'object' ? (body as Record<string, unknown>).data : undefined;
  const code =
    data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>).error_code
      : undefined;
  if (typeof code === 'string' && /^[A-Z0-9_]{1,40}$/.test(code)) return `ZEPTOMAIL_${code}`;
  return status >= 500 ? 'ZEPTOMAIL_UNAVAILABLE' : 'ZEPTOMAIL_SEND_FAILED';
}

function parseSignatureHeader(header: string) {
  const parts = new Map<string, string>();
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index > 0) parts.set(part.slice(0, index).trim(), part.slice(index + 1).trim());
  }
  const timestamp = Number(parts.get('ts'));
  let signature = '';
  try {
    signature = decodeURIComponent(parts.get('s') ?? '');
  } catch {
    signature = '';
  }
  return { timestamp, signature, algorithm: parts.get('s-algorithm') ?? '' };
}

/**
 * ZeptoMail may post the event as raw JSON or as one form field whose value is
 * the JSON. Its sample verifier signs the decoded field value, so both
 * representations are candidates; each is checked against the same secret.
 */
export function zeptoMailPayloadCandidates(rawBody: string) {
  const candidates = [rawBody];
  const trimmed = rawBody.trim();
  const index = rawBody.indexOf('=');
  if (!trimmed.startsWith('{') && index > 0) {
    try {
      candidates.push(decodeURIComponent(rawBody.slice(index + 1).replace(/\+/g, ' ')));
    } catch {
      // A malformed form value cannot verify; the raw body still can.
    }
  }
  return candidates;
}

/**
 * Verifies the `producer-signature` header (HMAC-SHA256 with the Agent's
 * webhook Authentication Key) and returns the signed payload text, or null.
 */
export function verifyZeptoMailWebhook(input: {
  rawBody: string;
  signatureHeader: string;
  secret: string;
  now?: number;
}) {
  if (!input.secret || !input.signatureHeader) return null;
  const { timestamp, signature, algorithm } = parseSignatureHeader(input.signatureHeader);
  if (algorithm && algorithm.toLowerCase() !== 'hmacsha256') return null;
  const now = input.now ?? Date.now();
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > ZEPTOMAIL_WEBHOOK_TOLERANCE_MS)
    return null;
  const provided = Buffer.from(signature, 'base64');
  if (provided.length !== 32) return null;
  for (const candidate of zeptoMailPayloadCandidates(input.rawBody)) {
    const expected = createHmac('sha256', input.secret).update(candidate, 'utf8').digest();
    if (timingSafeEqual(expected, provided)) return candidate;
  }
  return null;
}

export type ZeptoMailWebhookEvent = {
  eventId: string;
  /** Normalised to the queue's provider-neutral event names. */
  eventType: 'email.delivered' | 'email.bounced' | 'email.delivery_delayed' | 'email.complained';
  providerMessageId: string;
  createdAt: string | null;
  errorCode: string;
};

function record(value: unknown) {
  if (Array.isArray(value)) value = value[0];
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function text(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/**
 * Maps a verified ZeptoMail webhook to a queue update. Opens and clicks are
 * ignored (tracking is off). Returns null for anything the queue does not use.
 */
export function zeptoMailWebhookEvent(payload: unknown): ZeptoMailWebhookEvent | null {
  const root = record(payload);
  const message = record(root.event_message);
  const data = record(message.event_data);
  const details = record(data.details);
  const kind = [text(root.event_name, 60), text(data.object, 60), text(message.object, 60)]
    .join(' ')
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  const eventType: ZeptoMailWebhookEvent['eventType'] | null = kind.includes('hardbounce')
    ? 'email.bounced'
    : kind.includes('softbounce')
      ? 'email.delivery_delayed'
      : kind.includes('fbl') || kind.includes('complaint') || kind.includes('feedback')
        ? 'email.complained'
        : kind.includes('deliver')
          ? 'email.delivered'
          : null;
  const providerMessageId = text(message.request_id, 200);
  const webhookId = text(root.webhook_request_id, 180);
  if (!eventType || !providerMessageId || !webhookId) return null;
  const time = text(details.time, 60) || text(record(message.email_info).processed_time, 60);
  return {
    eventId: `zeptomail:${webhookId}`,
    eventType,
    providerMessageId,
    createdAt: time && Number.isFinite(Date.parse(time)) ? new Date(time).toISOString() : null,
    errorCode: text(details.reason, 100) || text(details.diagnostic_message, 100),
  };
}
