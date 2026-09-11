import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { logServerEvent } from '@/lib/observability/server';
import { paystackProvider, PaymentProviderError } from './paystack';

const paymentReferencePattern = /^[A-Za-z0-9._=-]{6,100}$/;

type InitializationContext = {
  paymentId: string;
  tenantId: string;
  orderId: string;
  orderReference: string;
  accessToken: string;
  storeSlug: string;
  customerEmail: string;
  amountSubunit: number;
  currency: string;
  subaccountCode: string;
  platformPercentage: number;
  feeBearer: 'ACCOUNT' | 'SUBACCOUNT';
  status: string;
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function applicationBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (!configured) throw new PaymentProviderError('APPLICATION_URL_NOT_CONFIGURED');
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new PaymentProviderError('APPLICATION_URL_NOT_CONFIGURED');
  }
  const local = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (
    (!local && url.protocol !== 'https:') ||
    (local && !['http:', 'https:'].includes(url.protocol))
  )
    throw new PaymentProviderError('APPLICATION_URL_NOT_CONFIGURED');
  return new URL('/', url).toString();
}

async function initializationContext(reference: string) {
  if (!paymentReferencePattern.test(reference)) throw new PaymentProviderError('INVALID_REFERENCE');
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('get_paystack_initialization_context', {
    provider_reference: reference,
  });
  if (error || !record(data)) throw new PaymentProviderError('PAYMENT_NOT_FOUND');
  return data as InitializationContext;
}

async function saveInitialization(
  reference: string,
  result:
    | { succeeded: true; accessCode: string; authorizationUrl: string }
    | { succeeded: false; errorCode: string },
) {
  const admin = createAdminClient();
  const { error } = await admin.rpc('record_paystack_initialization', {
    provider_reference: reference,
    succeeded: result.succeeded,
    provider_access_code: result.succeeded ? result.accessCode : '',
    provider_authorization_url: result.succeeded ? result.authorizationUrl : '',
    failure: result.succeeded ? '' : result.errorCode,
  });
  if (error) throw new PaymentProviderError('PAYMENT_STATE_WRITE_FAILED');
}

export async function initializeStoredPaystackPayment(reference: string) {
  const context = await initializationContext(reference);
  if (context.status !== 'INITIALIZING')
    throw new PaymentProviderError('PAYMENT_ALREADY_INITIALIZED');
  try {
    const initialized = await paystackProvider.initializePayment({
      reference,
      email: context.customerEmail,
      amountSubunit: context.amountSubunit,
      currency: context.currency,
      callbackUrl: new URL('/payments/paystack/callback', applicationBaseUrl()).toString(),
      subaccountCode: context.subaccountCode,
      feeBearer: context.feeBearer,
      metadata: {
        order_reference: context.orderReference,
        store_slug: context.storeSlug,
      },
    });
    await saveInitialization(reference, {
      succeeded: true,
      accessCode: initialized.accessCode,
      authorizationUrl: initialized.authorizationUrl,
    });
    return initialized.authorizationUrl;
  } catch (error) {
    const errorCode =
      error instanceof PaymentProviderError ? error.code : 'PAYSTACK_INITIALIZATION_FAILED';
    await saveInitialization(reference, { succeeded: false, errorCode }).catch(() => undefined);
    await logServerEvent({
      event: 'PAYSTACK_INITIALIZATION_FAILED',
      level: 'error',
      operation: 'initialize_payment',
      tenantId: context.tenantId,
      resourceType: 'payments',
      resourceId: context.paymentId,
      provider: 'paystack',
      success: false,
      errorCode,
    });
    throw new PaymentProviderError(errorCode);
  }
}

export async function verifyAndApplyPaystackPayment(reference: string) {
  const verified = await paystackProvider.verifyPayment(reference);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('confirm_paystack_payment', {
    provider_reference: verified.reference,
    paid_amount_subunit: verified.amountSubunit,
    paid_currency: verified.currency,
    provider_status: verified.status,
    fee_subunit: verified.feeSubunit,
    paid_timestamp:
      verified.paidAt && Number.isFinite(Date.parse(verified.paidAt)) ? verified.paidAt : null,
  });
  if (error) throw new PaymentProviderError('PAYMENT_RECONCILIATION_FAILED');
  return String(data ?? 'UNKNOWN');
}

export async function getPaystackCallbackContext(reference: string) {
  try {
    return await initializationContext(reference);
  } catch {
    return null;
  }
}

export async function processPaystackWebhookPayload(payload: unknown) {
  const event = record(payload);
  const data = record(event?.data);
  const eventType = typeof event?.event === 'string' ? event.event.slice(0, 100) : '';
  const transactionId =
    typeof data?.id === 'number' || typeof data?.id === 'string' ? String(data.id) : '';
  if (!eventType || !transactionId || transactionId.length > 100)
    throw new PaymentProviderError('INVALID_WEBHOOK_EVENT');
  const amount = Number(data?.amount ?? 0);
  const fee = data?.fees === null || data?.fees === undefined ? null : Number(data.fees);
  const reference = typeof data?.reference === 'string' ? data.reference : '';
  if (
    (eventType === 'charge.success' && !paymentReferencePattern.test(reference)) ||
    !Number.isSafeInteger(amount) ||
    amount < 0 ||
    (fee !== null && (!Number.isSafeInteger(fee) || fee < 0))
  )
    throw new PaymentProviderError('INVALID_WEBHOOK_EVENT');
  const admin = createAdminClient();
  const { data: result, error } = await admin.rpc('process_paystack_webhook', {
    p_event_key: `${eventType}:${transactionId}`,
    p_event_type: eventType,
    p_provider_reference: reference,
    p_paid_amount_subunit: amount,
    p_paid_currency: String(data?.currency ?? '').toUpperCase(),
    p_provider_status: String(data?.status ?? ''),
    p_fee_subunit: fee,
    p_paid_timestamp:
      typeof data?.paid_at === 'string' && Number.isFinite(Date.parse(data.paid_at))
        ? data.paid_at
        : null,
    p_safe_metadata: {
      transactionId,
      channel: typeof data?.channel === 'string' ? data.channel.slice(0, 40) : '',
      gatewayResponse:
        typeof data?.gateway_response === 'string' ? data.gateway_response.slice(0, 100) : '',
    },
  });
  if (error) throw new PaymentProviderError('WEBHOOK_STATE_WRITE_FAILED');
  return String(result ?? 'UNKNOWN');
}
