import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  ConnectedSettlement,
  PaymentInitialization,
  PaymentProvider,
  RefundResult,
  SettlementAccount,
  SettlementBank,
  VerifiedPayment,
} from './types';

const PAYSTACK_API = 'https://api.paystack.co';
const referencePattern = /^[A-Za-z0-9._=-]{6,100}$/;
const subaccountPattern = /^ACCT_[A-Za-z0-9]+$/;

export class PaymentProviderError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'PaymentProviderError';
  }
}

function secretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key?.startsWith('sk_')) throw new PaymentProviderError('PAYSTACK_NOT_CONFIGURED');
  return key;
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

async function paystackRequest(path: string, init: RequestInit = {}) {
  let response: Response;
  try {
    response = await fetch(`${PAYSTACK_API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${secretKey()}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new PaymentProviderError('PAYSTACK_UNREACHABLE');
  }
  const payload = object(await response.json().catch(() => null));
  if (!response.ok || payload?.status !== true || !object(payload.data))
    throw new PaymentProviderError(`PAYSTACK_HTTP_${response.status}`);
  return object(payload.data)!;
}

function checkoutUrl(value: unknown) {
  if (typeof value !== 'string') throw new PaymentProviderError('PAYSTACK_INVALID_RESPONSE');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new PaymentProviderError('PAYSTACK_INVALID_RESPONSE');
  }
  if (url.protocol !== 'https:' || url.hostname !== 'checkout.paystack.com')
    throw new PaymentProviderError('PAYSTACK_INVALID_RESPONSE');
  return url.toString();
}

export const paystackProvider: PaymentProvider = {
  async initializePayment(input): Promise<PaymentInitialization> {
    if (
      !referencePattern.test(input.reference) ||
      !subaccountPattern.test(input.subaccountCode) ||
      !Number.isSafeInteger(input.amountSubunit) ||
      input.amountSubunit <= 0 ||
      !/^[A-Z]{3}$/.test(input.currency)
    )
      throw new PaymentProviderError('INVALID_PAYMENT_INITIALIZATION');
    const data = await paystackRequest('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: input.email,
        amount: String(input.amountSubunit),
        currency: input.currency,
        reference: input.reference,
        callback_url: input.callbackUrl,
        subaccount: input.subaccountCode,
        bearer: input.feeBearer === 'SUBACCOUNT' ? 'subaccount' : 'account',
        metadata: input.metadata,
      }),
    });
    const reference = String(data.reference ?? '');
    const accessCode = String(data.access_code ?? '');
    if (reference !== input.reference || !accessCode || accessCode.length > 200)
      throw new PaymentProviderError('PAYSTACK_INVALID_RESPONSE');
    return {
      reference,
      accessCode,
      authorizationUrl: checkoutUrl(data.authorization_url),
    };
  },

  async verifyPayment(reference): Promise<VerifiedPayment> {
    if (!referencePattern.test(reference)) throw new PaymentProviderError('INVALID_REFERENCE');
    const data = await paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
    const amount = Number(data.amount);
    const fee = data.fees === null || data.fees === undefined ? null : Number(data.fees);
    if (
      String(data.reference ?? '') !== reference ||
      !Number.isSafeInteger(amount) ||
      amount <= 0 ||
      (fee !== null && (!Number.isSafeInteger(fee) || fee < 0))
    )
      throw new PaymentProviderError('PAYSTACK_INVALID_RESPONSE');
    return {
      reference,
      status: String(data.status ?? ''),
      amountSubunit: amount,
      currency: String(data.currency ?? '').toUpperCase(),
      feeSubunit: fee,
      paidAt: typeof data.paid_at === 'string' ? data.paid_at : null,
    };
  },

  async refundPayment(input): Promise<RefundResult> {
    if (
      !referencePattern.test(input.reference) ||
      !Number.isSafeInteger(input.amountSubunit) ||
      input.amountSubunit <= 0 ||
      !/^[A-Z]{3}$/.test(input.currency) ||
      input.customerNote.length > 200 ||
      input.merchantNote.length > 200
    )
      throw new PaymentProviderError('INVALID_REFUND');
    const data = await paystackRequest('/refund', {
      method: 'POST',
      body: JSON.stringify({
        transaction: input.reference,
        amount: input.amountSubunit,
        currency: input.currency,
        customer_note: input.customerNote,
        merchant_note: input.merchantNote,
      }),
    });
    const amount = Number(data.amount);
    const providerRefundId = String(data.id ?? '');
    if (!providerRefundId || !Number.isSafeInteger(amount) || amount !== input.amountSubunit)
      throw new PaymentProviderError('PAYSTACK_INVALID_RESPONSE');
    return {
      providerRefundId,
      status: String(data.status ?? ''),
      amountSubunit: amount,
      currency: String(data.currency ?? '').toUpperCase(),
    };
  },

  verifyWebhook(rawBody, signature) {
    return verifyPaystackSignature(rawBody, signature);
  },
};

let bankCache: { expiresAt: number; banks: SettlementBank[] } | null = null;

export async function listPaystackBanks(): Promise<SettlementBank[]> {
  if (bankCache && bankCache.expiresAt > Date.now()) return bankCache.banks;
  const response = await fetch(`${PAYSTACK_API}/bank?country=nigeria&currency=NGN&perPage=100`, {
    headers: { Authorization: `Bearer ${secretKey()}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  }).catch(() => null);
  const payload = response ? object(await response.json().catch(() => null)) : null;
  const data = Array.isArray(payload?.data) ? payload.data : null;
  if (!response?.ok || payload?.status !== true || !data)
    throw new PaymentProviderError(
      response ? `PAYSTACK_HTTP_${response.status}` : 'PAYSTACK_UNREACHABLE',
    );
  const banks = data
    .map(object)
    .filter((bank): bank is Record<string, unknown> => Boolean(bank))
    .map((bank) => ({ code: String(bank.code ?? ''), name: String(bank.name ?? '') }))
    .filter(
      (bank) =>
        /^[0-9A-Za-z_-]{2,30}$/.test(bank.code) && bank.name.length >= 2 && bank.name.length <= 120,
    )
    .sort((first, second) => first.name.localeCompare(second.name));
  if (!banks.length) throw new PaymentProviderError('PAYSTACK_INVALID_RESPONSE');
  bankCache = { expiresAt: Date.now() + 60 * 60 * 1000, banks };
  return banks;
}

export async function resolvePaystackAccount(
  bankCode: string,
  accountNumber: string,
): Promise<SettlementAccount> {
  const data = await paystackRequest(
    `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
  );
  const resolvedNumber = String(data.account_number ?? '');
  const accountName = String(data.account_name ?? '').trim();
  if (resolvedNumber !== accountNumber || accountName.length < 2 || accountName.length > 160)
    throw new PaymentProviderError('PAYSTACK_INVALID_RESPONSE');
  return { accountNumber: resolvedNumber, accountName };
}

export async function savePaystackSubaccount(input: {
  currentCode?: string;
  businessName: string;
  bankCode: string;
  bankName: string;
  account: SettlementAccount;
  contactName: string;
  contactEmail: string;
}): Promise<ConnectedSettlement> {
  const path = input.currentCode
    ? `/subaccount/${encodeURIComponent(input.currentCode)}`
    : '/subaccount';
  const data = await paystackRequest(path, {
    method: input.currentCode ? 'PUT' : 'POST',
    body: JSON.stringify({
      business_name: input.businessName,
      bank_code: input.bankCode,
      settlement_bank: input.bankCode,
      account_number: input.account.accountNumber,
      percentage_charge: 0,
      primary_contact_name: input.contactName,
      primary_contact_email: input.contactEmail,
      description: `${input.businessName} BusinessCare storefront settlement`,
    }),
  });
  const subaccountCode = String(data.subaccount_code ?? input.currentCode ?? '');
  const providerAccountName = String(data.account_name ?? input.account.accountName).trim();
  if (!subaccountPattern.test(subaccountCode) || providerAccountName.length < 2)
    throw new PaymentProviderError('PAYSTACK_INVALID_RESPONSE');
  return {
    subaccountCode,
    bankCode: input.bankCode,
    bankName: input.bankName,
    accountNumber: input.account.accountNumber,
    accountName: providerAccountName,
  };
}

export function verifyPaystackSignature(rawBody: string, signature: string | null) {
  if (!signature || !/^[0-9a-f]{128}$/i.test(signature)) return false;
  const expected = createHmac('sha512', secretKey()).update(rawBody).digest();
  const received = Buffer.from(signature, 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}
