import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { SmsDeliveryMode } from './types';

export class SmsProviderError extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable = false,
    public readonly deliveryUnknown = false,
  ) {
    super(code);
    this.name = 'SmsProviderError';
  }
}

export type SmsSendInput = {
  to: string;
  senderId: string;
  message: string;
  idempotencyKey: string;
};

export type ProviderSenderId = { senderId: string; status: 'PENDING' | 'APPROVED' | 'REJECTED' };

export interface SmsProvider {
  send(input: SmsSendInput): Promise<{ providerMessageId: string }>;
  requestSenderId(input: { senderId: string; companyName: string; useCase: string }): Promise<void>;
  listSenderIds(): Promise<ProviderSenderId[]>;
}

function configuredMode(): SmsDeliveryMode {
  const value = String(process.env.SMS_DELIVERY_MODE ?? 'disabled').toLowerCase();
  return ['disabled', 'test', 'live'].includes(value) ? (value as SmsDeliveryMode) : 'disabled';
}

function configuredBaseUrl() {
  const raw = String(process.env.TERMII_BASE_URL ?? '').trim();
  try {
    const url = new URL(raw);
    if (
      url.protocol !== 'https:' ||
      !(url.hostname === 'termii.com' || url.hostname.endsWith('.termii.com'))
    )
      return '';
    return url.origin;
  } catch {
    return '';
  }
}

export function smsDeliveryConfiguration() {
  const mode = configuredMode();
  const baseUrl = configuredBaseUrl();
  return {
    mode,
    baseUrl,
    configured:
      mode !== 'disabled' &&
      Boolean(baseUrl) &&
      Boolean(String(process.env.TERMII_API_KEY ?? '').trim()),
    testRecipient: normalizeSmsPhone(String(process.env.SMS_TEST_RECIPIENT ?? '')),
    channel: ['generic', 'dnd'].includes(String(process.env.TERMII_SMS_CHANNEL ?? '').toLowerCase())
      ? String(process.env.TERMII_SMS_CHANNEL).toLowerCase()
      : 'generic',
  };
}

export function normalizeSmsPhone(value: string) {
  let normalized = value.trim().replace(/[^0-9+]/g, '');
  if (normalized.startsWith('+')) normalized = normalized.slice(1);
  if (/^0[789][01][0-9]{8}$/.test(normalized)) normalized = `234${normalized.slice(1)}`;
  return /^[1-9][0-9]{7,14}$/.test(normalized) ? normalized : '';
}

function apiKey() {
  const value = String(process.env.TERMII_API_KEY ?? '').trim();
  if (!value) throw new SmsProviderError('TERMII_NOT_CONFIGURED', true);
  return value;
}

async function termiiRequest(path: string, body: Record<string, unknown>) {
  const config = smsDeliveryConfiguration();
  if (!config.baseUrl) throw new SmsProviderError('TERMII_BASE_URL_INVALID', true);
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ ...body, api_key: apiKey() }),
      signal: AbortSignal.timeout(12_000),
      cache: 'no-store',
    });
  } catch {
    throw new SmsProviderError('TERMII_CONNECTION_UNKNOWN', false, true);
  }
  if (!response.ok) {
    if (response.status === 429) throw new SmsProviderError('TERMII_RATE_LIMITED', true);
    if (response.status >= 500)
      throw new SmsProviderError(`TERMII_HTTP_${response.status}`, false, true);
    throw new SmsProviderError(`TERMII_HTTP_${response.status}`);
  }
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    throw new SmsProviderError('TERMII_RESPONSE_UNKNOWN', false, true);
  }
}

class TermiiSmsProvider implements SmsProvider {
  async send(input: SmsSendInput) {
    const config = smsDeliveryConfiguration();
    if (config.mode === 'disabled' || !config.configured)
      throw new SmsProviderError('SMS_DELIVERY_DISABLED', true);
    const to = normalizeSmsPhone(input.to);
    if (!to) throw new SmsProviderError('SMS_RECIPIENT_INVALID');
    if (config.mode === 'test' && (!config.testRecipient || to !== config.testRecipient))
      throw new SmsProviderError('SMS_TEST_RECIPIENT_BLOCKED');
    if (!/^(?=.*[A-Za-z])[A-Za-z0-9 ]{3,11}$/.test(input.senderId))
      throw new SmsProviderError('SMS_SENDER_INVALID');
    if (!input.message.trim() || input.message.length > 320)
      throw new SmsProviderError('SMS_MESSAGE_INVALID');
    const data = await termiiRequest('/api/sms/send', {
      to,
      from: input.senderId,
      sms: input.message,
      type: 'plain',
      channel: config.channel,
    });
    const providerMessageId = typeof data.message_id === 'string' ? data.message_id : '';
    if (!providerMessageId || providerMessageId.length > 200)
      throw new SmsProviderError('TERMII_ACCEPTANCE_UNKNOWN', false, true);
    return { providerMessageId };
  }

  async requestSenderId(input: { senderId: string; companyName: string; useCase: string }) {
    const data = await termiiRequest('/api/sender-id/request', {
      sender_id: input.senderId,
      company: input.companyName,
      usecase: input.useCase,
    });
    if (String(data.code ?? '').toLowerCase() !== 'ok')
      throw new SmsProviderError('TERMII_SENDER_REQUEST_REJECTED');
  }

  async listSenderIds() {
    const config = smsDeliveryConfiguration();
    if (!config.baseUrl) throw new SmsProviderError('TERMII_BASE_URL_INVALID', true);
    const url = new URL('/api/sender-id', config.baseUrl);
    url.searchParams.set('api_key', apiKey());
    let response: Response;
    try {
      response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(12_000) });
    } catch {
      throw new SmsProviderError('TERMII_SENDER_STATUS_UNAVAILABLE', true);
    }
    if (!response.ok) throw new SmsProviderError(`TERMII_HTTP_${response.status}`, true);
    const payload = (await response.json()) as { data?: unknown };
    if (!Array.isArray(payload.data)) throw new SmsProviderError('TERMII_RESPONSE_INVALID');
    return payload.data.slice(0, 100).flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const row = item as Record<string, unknown>;
      const senderId = typeof row.sender_id === 'string' ? row.sender_id.trim().toUpperCase() : '';
      const rawStatus = String(row.status ?? '').toLowerCase();
      if (!senderId) return [];
      const status: ProviderSenderId['status'] = ['unblock', 'approved', 'active'].includes(
        rawStatus,
      )
        ? 'APPROVED'
        : ['blocked', 'rejected', 'inactive'].includes(rawStatus)
          ? 'REJECTED'
          : 'PENDING';
      return [{ senderId, status }];
    });
  }
}

export function verifyTermiiSignature(rawBody: string, suppliedSignature: string | null) {
  // Termii Messaging DLRs document X-Termii-Signature as HMAC-SHA512 over the raw payload.
  const secret = String(
    process.env.TERMII_WEBHOOK_SECRET ?? process.env.TERMII_API_KEY ?? '',
  ).trim();
  const supplied = String(suppliedSignature ?? '')
    .replace(/^sha512=/i, '')
    .toLowerCase();
  if (!secret || !/^[a-f0-9]{128}$/.test(supplied)) return false;
  const expected = createHmac('sha512', secret).update(rawBody).digest('hex');
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(supplied, 'hex'));
}

export const smsProvider: SmsProvider = new TermiiSmsProvider();
