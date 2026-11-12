import 'server-only';
import { Resend } from 'resend';
import type { EmailDeliveryMode } from './types';
import {
  zeptoMailApiUrl,
  zeptoMailAuthorization,
  zeptoMailErrorCode,
  zeptoMailRequestBody,
  zeptoMailRequestId,
} from './zeptomail';

export class EmailProviderError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'EmailProviderError';
  }
}

export type EmailSendInput = {
  to: string;
  fromName: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
  tags: Array<{ name: string; value: string }>;
};

export interface EmailProvider {
  send(input: EmailSendInput): Promise<{ providerMessageId: string }>;
}

export type EmailProviderName = 'resend' | 'zeptomail';

/** EMAIL_PROVIDER selects the sender; anything unrecognised keeps Resend. */
export function configuredEmailProvider(): EmailProviderName {
  return String(process.env.EMAIL_PROVIDER ?? '')
    .trim()
    .toLowerCase() === 'zeptomail'
    ? 'zeptomail'
    : 'resend';
}

function providerCredentialsPresent(provider: EmailProviderName) {
  if (provider === 'zeptomail')
    return (
      Boolean(zeptoMailAuthorization(process.env.ZEPTOMAIL_API_TOKEN)) &&
      Boolean(zeptoMailApiUrl(process.env.ZEPTOMAIL_API_URL))
    );
  return Boolean(process.env.RESEND_API_KEY);
}

export function emailDeliveryConfiguration() {
  const configured = String(process.env.EMAIL_DELIVERY_MODE ?? 'disabled').toLowerCase();
  const mode: EmailDeliveryMode = ['disabled', 'test', 'live'].includes(configured)
    ? (configured as EmailDeliveryMode)
    : 'disabled';
  const provider = configuredEmailProvider();
  return {
    mode,
    provider,
    configured: mode !== 'disabled' && providerCredentialsPresent(provider),
    fromName: (process.env.EMAIL_FROM_NAME ?? 'Jeff from BusinessCare').trim(),
    fromAddress: (process.env.EMAIL_FROM_ADDRESS ?? 'onboarding@resend.dev').trim().toLowerCase(),
    replyTo: (process.env.EMAIL_REPLY_TO ?? '').trim().toLowerCase(),
    testRecipient: (process.env.EMAIL_TEST_RECIPIENT ?? '').trim().toLowerCase(),
  };
}

function validAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function safeDisplayName(value: string, fallback: string) {
  const sanitized = value
    .replace(/[\r\n<>\"]/g, '')
    .trim()
    .slice(0, 100);
  return (
    sanitized ||
    fallback
      .replace(/[\r\n<>\"]/g, '')
      .trim()
      .slice(0, 100)
  );
}

/** Checks every provider must pass before any network call is made. */
function checkedSender(input: EmailSendInput) {
  const config = emailDeliveryConfiguration();
  if (config.mode === 'disabled' || !config.configured)
    throw new EmailProviderError('EMAIL_DELIVERY_DISABLED');
  if (!validAddress(config.fromAddress)) throw new EmailProviderError('EMAIL_FROM_INVALID');
  if (!validAddress(input.to)) throw new EmailProviderError('EMAIL_RECIPIENT_INVALID');
  if (
    config.mode === 'test' &&
    (!validAddress(config.testRecipient) || input.to.toLowerCase() !== config.testRecipient)
  )
    throw new EmailProviderError('EMAIL_TEST_RECIPIENT_BLOCKED');
  const replyTo = input.replyTo || config.replyTo;
  return {
    fromAddress: config.fromAddress,
    fromName: safeDisplayName(input.fromName, config.fromName),
    replyTo: replyTo && validAddress(replyTo) ? replyTo : undefined,
  };
}

class ResendEmailProvider implements EmailProvider {
  async send(input: EmailSendInput) {
    const sender = checkedSender(input);
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new EmailProviderError('RESEND_NOT_CONFIGURED');
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send(
      {
        from: `${sender.fromName} <${sender.fromAddress}>`,
        to: [input.to],
        replyTo: sender.replyTo,
        subject: input.subject,
        html: input.html,
        text: input.text,
        tags: input.tags,
      },
      { idempotencyKey: input.idempotencyKey },
    );
    if (error || !data?.id)
      throw new EmailProviderError(
        typeof error?.name === 'string'
          ? `RESEND_${error.name.toUpperCase()}`
          : 'RESEND_SEND_FAILED',
      );
    return { providerMessageId: data.id };
  }
}

/** Upper bound for one ZeptoMail API call so a stalled request cannot hold the worker. */
const ZEPTOMAIL_TIMEOUT_MS = 15_000;

class ZeptoMailEmailProvider implements EmailProvider {
  async send(input: EmailSendInput) {
    const sender = checkedSender(input);
    const url = zeptoMailApiUrl(process.env.ZEPTOMAIL_API_URL);
    const authorization = zeptoMailAuthorization(process.env.ZEPTOMAIL_API_TOKEN);
    if (!url || !authorization) throw new EmailProviderError('ZEPTOMAIL_NOT_CONFIGURED');
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          authorization,
        },
        body: JSON.stringify(
          zeptoMailRequestBody({
            fromAddress: sender.fromAddress,
            fromName: sender.fromName,
            to: input.to,
            replyTo: sender.replyTo,
            subject: input.subject,
            html: input.html,
            text: input.text,
            clientReference: input.idempotencyKey,
          }),
        ),
        signal: AbortSignal.timeout(ZEPTOMAIL_TIMEOUT_MS),
        cache: 'no-store',
      });
    } catch {
      throw new EmailProviderError('ZEPTOMAIL_UNREACHABLE');
    }
    const body: unknown = await response.json().catch(() => null);
    const providerMessageId = zeptoMailRequestId(response.status, body);
    if (!providerMessageId) throw new EmailProviderError(zeptoMailErrorCode(response.status, body));
    return { providerMessageId };
  }
}

export const emailProvider: EmailProvider = {
  send(input) {
    // Resolved per send so a configuration change applies without a rebuild.
    return configuredEmailProvider() === 'zeptomail'
      ? new ZeptoMailEmailProvider().send(input)
      : new ResendEmailProvider().send(input);
  },
};
