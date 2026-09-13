import 'server-only';
import { Resend } from 'resend';
import type { EmailDeliveryMode } from './types';

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

export function emailDeliveryConfiguration() {
  const configured = String(process.env.EMAIL_DELIVERY_MODE ?? 'disabled').toLowerCase();
  const mode: EmailDeliveryMode = ['disabled', 'test', 'live'].includes(configured)
    ? (configured as EmailDeliveryMode)
    : 'disabled';
  return {
    mode,
    configured: mode !== 'disabled' && Boolean(process.env.RESEND_API_KEY),
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

class ResendEmailProvider implements EmailProvider {
  async send(input: EmailSendInput) {
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
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new EmailProviderError('RESEND_NOT_CONFIGURED');
    const resend = new Resend(apiKey);
    const replyTo = input.replyTo || config.replyTo;
    const { data, error } = await resend.emails.send(
      {
        from: `${safeDisplayName(input.fromName, config.fromName)} <${config.fromAddress}>`,
        to: [input.to],
        replyTo: replyTo && validAddress(replyTo) ? replyTo : undefined,
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

export const emailProvider: EmailProvider = new ResendEmailProvider();
