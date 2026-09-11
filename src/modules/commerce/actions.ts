'use server';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { logServerEvent } from '@/lib/observability/server';
import { createClient } from '@/lib/supabase/server';
import { getTenantWorkspace } from '@/modules/tenants/workspace-query';
import {
  listPaystackBanks,
  PaymentProviderError,
  resolvePaystackAccount,
  savePaystackSubaccount,
} from '@/modules/payments/paystack';
import {
  initializeStoredPaystackPayment,
  verifyAndApplyPaystackPayment,
} from '@/modules/payments/service';
import type { CartLine, CheckoutQuote, CreatedOrder } from './types';
import { commerceErrorMessage, parseCart, validateCheckout } from './validation';

export type CheckoutActionState = { error: string; order: CreatedOrder | null };
export type CommerceActionState = { error: string; message: string };
export type PaymentActionState = { error: string; authorizationUrl: string };

function canManage(role: string) {
  return ['TENANT_OWNER', 'TENANT_ADMIN', 'TENANT_MANAGER'].includes(role);
}

async function managerWorkspace(slug: string) {
  const workspace = await getTenantWorkspace(slug);
  if (!canManage(workspace.membership.role)) throw new Error('FORBIDDEN');
  return workspace;
}

export async function quoteCart(slug: string, cart: CartLine[]) {
  const validated = parseCart(cart);
  if (!validated) return { error: 'Your cart could not be read.', quote: null };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_public_checkout_quote', {
    store_slug: slug,
    cart_items: validated,
  });
  if (error) return { error: commerceErrorMessage(error.message), quote: null };
  if (!data) return { error: 'This store is not accepting orders right now.', quote: null };
  return { error: '', quote: data as CheckoutQuote };
}

export async function createOrder(
  slug: string,
  _state: CheckoutActionState,
  form: FormData,
): Promise<CheckoutActionState> {
  const validation = validateCheckout(form);
  if (!validation.input) return { error: validation.error ?? 'Check your order.', order: null };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_storefront_order', {
    store_slug: slug,
    cart_items: validation.input.cart,
    customer_details: validation.input.customer,
    shipping_address: validation.input.address,
    selected_shipping_rate: validation.input.shippingRate,
    payment_choice: validation.input.paymentChoice,
    customer_note: validation.input.note,
  });
  if (error) return { error: commerceErrorMessage(error.message), order: null };
  const order = data as CreatedOrder;
  if (order.paymentMethod !== 'PAYSTACK' || !order.paymentReference) return { error: '', order };
  try {
    order.paymentAuthorizationUrl = await initializeStoredPaystackPayment(order.paymentReference);
  } catch {
    order.paymentError =
      'Your order was saved, but secure payment could not open. You can try payment again below.';
  }
  return { error: '', order };
}

export async function retryPaystackPayment(
  slug: string,
  orderReference: string,
  accessToken: string,
  _state: PaymentActionState,
): Promise<PaymentActionState> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !/^BC-[A-Z0-9-]{8,40}$/.test(orderReference))
    return { error: 'This payment link is not valid.', authorizationUrl: '' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('prepare_paystack_retry', {
    store_slug: slug,
    order_reference: orderReference,
    access_token: accessToken,
  });
  if (error || typeof data !== 'string')
    return { error: commerceErrorMessage(error?.message ?? ''), authorizationUrl: '' };
  try {
    return { error: '', authorizationUrl: await initializeStoredPaystackPayment(data) };
  } catch {
    return {
      error: 'Secure payment could not open. Your order is still saved; please try again shortly.',
      authorizationUrl: '',
    };
  }
}

export async function reconcilePaystackOrder(
  slug: string,
  orderId: string,
  _state: CommerceActionState,
): Promise<CommerceActionState> {
  const workspace = await managerWorkspace(slug);
  const { data, error } = await workspace.supabase
    .from('payments')
    .select('provider_reference')
    .eq('tenant_id', workspace.tenant.id)
    .eq('order_id', orderId)
    .in('status', ['PENDING', 'INITIALIZING', 'FAILED'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return { error: 'No Paystack payment is available to check.', message: '' };
  try {
    const result = await verifyAndApplyPaystackPayment(data.provider_reference);
    revalidatePath(`/t/${slug}/orders/${orderId}`);
    return result === 'PROCESSED' || result === 'ALREADY_PROCESSED'
      ? { error: '', message: 'Paystack confirmed this payment.' }
      : { error: '', message: 'Paystack has not confirmed this payment yet.' };
  } catch (providerError) {
    const code = providerError instanceof PaymentProviderError ? providerError.code : '';
    return {
      error:
        code === 'PAYSTACK_NOT_CONFIGURED'
          ? 'Paystack is not configured for this environment.'
          : 'Paystack could not be reached. The order was not changed.',
      message: '',
    };
  }
}

export async function submitTransferNotice(
  slug: string,
  reference: string,
  accessToken: string,
): Promise<CommerceActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('submit_bank_transfer_notice', {
    store_slug: slug,
    order_reference: reference,
    access_token: accessToken,
  });
  return error
    ? { error: commerceErrorMessage(error.message), message: '' }
    : {
        error: '',
        message: 'Payment notice sent. The store will verify the transfer before marking it paid.',
      };
}

export async function saveCheckoutSettings(
  slug: string,
  _state: CommerceActionState,
  form: FormData,
): Promise<CommerceActionState> {
  const workspace = await managerWorkspace(slug);
  const message = String(form.get('successMessage') ?? '').trim();
  if (!message || message.length > 500)
    return { error: 'Enter a confirmation message of 500 characters or fewer.', message: '' };
  const { error } = await workspace.supabase.rpc('save_checkout_settings_complete', {
    target_tenant: workspace.tenant.id,
    phone_required: form.get('collectPhone') === 'on',
    email_required: form.get('collectEmail') === 'on',
    address_required: form.get('collectAddress') === 'on',
    notes_enabled: form.get('orderNotes') === 'on',
    transfer_enabled: form.get('bankTransfer') === 'on',
    paystack_payment_enabled: form.get('paystack') === 'on',
    confirmation_message: message,
  });
  if (error) return { error: commerceErrorMessage(error.message), message: '' };
  revalidatePath(`/t/${slug}/orders/settings`);
  return { error: '', message: 'Checkout choices saved.' };
}

export async function connectPaystackSettlement(
  slug: string,
  _state: CommerceActionState,
  form: FormData,
): Promise<CommerceActionState> {
  const workspace = await managerWorkspace(slug);
  const bankCode = String(form.get('bankCode') ?? '').trim();
  const accountNumber = String(form.get('settlementAccountNumber') ?? '').replace(/\s/g, '');
  if (!/^[0-9A-Za-z_-]{2,30}$/.test(bankCode) || !/^[0-9]{10}$/.test(accountNumber))
    return {
      error: 'Choose a bank and enter the 10-digit settlement account number.',
      message: '',
    };
  let providerConnection: Awaited<ReturnType<typeof savePaystackSubaccount>> | null = null;
  try {
    const [banks, businessResult, paymentResult] = await Promise.all([
      listPaystackBanks(),
      workspace.supabase
        .from('tenant_business_settings')
        .select('business_name,contact_email')
        .eq('tenant_id', workspace.tenant.id)
        .single(),
      workspace.supabase
        .from('tenant_payment_settings')
        .select('subaccount_code')
        .eq('tenant_id', workspace.tenant.id)
        .single(),
    ]);
    const bank = banks.find((candidate) => candidate.code === bankCode);
    if (!bank || businessResult.error || paymentResult.error)
      return { error: 'Settlement details could not be prepared safely.', message: '' };
    const account = await resolvePaystackAccount(bank.code, accountNumber);
    providerConnection = await savePaystackSubaccount({
      currentCode: paymentResult.data.subaccount_code ?? undefined,
      businessName: businessResult.data.business_name,
      bankCode: bank.code,
      bankName: bank.name,
      account,
      contactName: businessResult.data.business_name,
      contactEmail: businessResult.data.contact_email,
    });
    const admin = createAdminClient();
    const { error } = await admin.rpc('record_paystack_connection', {
      target_tenant: workspace.tenant.id,
      actor_user: workspace.membership.user_id,
      provider_payload: {
        subaccountCode: providerConnection.subaccountCode,
        bankCode: providerConnection.bankCode,
        bankName: providerConnection.bankName,
        accountLast4: providerConnection.accountNumber.slice(-4),
        accountName: providerConnection.accountName,
      },
    });
    if (error) throw new Error('PAYSTACK_CONNECTION_WRITE_FAILED');
    revalidatePath(`/t/${slug}/orders/settings`);
    return {
      error: '',
      message: `Secure online payments will settle to ${providerConnection.accountName}.`,
    };
  } catch (error) {
    const errorCode =
      error instanceof PaymentProviderError ? error.code : 'PAYSTACK_CONNECTION_FAILED';
    await logServerEvent({
      event: providerConnection
        ? 'PAYSTACK_SUBACCOUNT_REQUIRES_RECONCILIATION'
        : 'PAYSTACK_CONNECTION_FAILED',
      level: 'error',
      operation: 'connect_settlement_account',
      tenantId: workspace.tenant.id,
      provider: 'paystack',
      success: false,
      errorCode,
    });
    return {
      error:
        errorCode === 'PAYSTACK_NOT_CONFIGURED'
          ? 'Paystack test keys are not configured for this environment.'
          : 'Paystack could not verify this account. Check the bank details and try again.',
      message: '',
    };
  }
}

export async function saveBankAccount(
  slug: string,
  _state: CommerceActionState,
  form: FormData,
): Promise<CommerceActionState> {
  const workspace = await managerWorkspace(slug);
  const bankName = String(form.get('bankName') ?? '').trim();
  const accountNumber = String(form.get('accountNumber') ?? '').replace(/\s/g, '');
  const accountName = String(form.get('accountName') ?? '').trim();
  const instructions = String(form.get('instructions') ?? '').trim();
  if (
    bankName.length < 2 ||
    bankName.length > 100 ||
    !/^[0-9]{6,20}$/.test(accountNumber) ||
    accountName.length < 2 ||
    accountName.length > 160 ||
    instructions.length > 1000
  )
    return { error: 'Check the bank name, account number, and account name.', message: '' };
  const { error } = await workspace.supabase.rpc('save_bank_account', {
    target_tenant: workspace.tenant.id,
    bank_name: bankName,
    account_number: accountNumber,
    account_name: accountName,
    instructions,
  });
  if (error) return { error: commerceErrorMessage(error.message), message: '' };
  revalidatePath(`/t/${slug}/orders/settings`);
  return { error: '', message: 'Bank-transfer details saved.' };
}

export async function saveShippingRate(
  slug: string,
  _state: CommerceActionState,
  form: FormData,
): Promise<CommerceActionState> {
  const workspace = await managerWorkspace(slug);
  const zoneName = String(form.get('zoneName') ?? '').trim();
  const rateName = String(form.get('rateName') ?? '').trim();
  const amount = Number(form.get('amount'));
  const states = String(form.get('states') ?? '')
    .split(',')
    .map((state) => state.trim())
    .filter(Boolean);
  if (
    zoneName.length < 2 ||
    zoneName.length > 100 ||
    rateName.length < 2 ||
    rateName.length > 100 ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    states.length > 50
  )
    return { error: 'Check the delivery name, region, and fee.', message: '' };
  const { error } = await workspace.supabase.rpc('save_shipping_rate', {
    target_tenant: workspace.tenant.id,
    target_rate: null,
    zone_name: zoneName,
    rate_name: rateName,
    rate_amount: amount,
    delivery_states: states,
    pickup: form.get('pickup') === 'on',
  });
  if (error) return { error: commerceErrorMessage(error.message), message: '' };
  revalidatePath(`/t/${slug}/orders/settings`);
  return { error: '', message: 'Delivery option added.' };
}

export async function removeShippingRate(slug: string, rateId: string) {
  const workspace = await managerWorkspace(slug);
  const { error } = await workspace.supabase.rpc('delete_shipping_rate', {
    target_tenant: workspace.tenant.id,
    target_rate: rateId,
  });
  if (error) throw new Error(commerceErrorMessage(error.message));
  revalidatePath(`/t/${slug}/orders/settings`);
}

async function runOrderAction(
  slug: string,
  orderId: string,
  action: string,
  note: string,
): Promise<CommerceActionState> {
  const workspace = await managerWorkspace(slug);
  if (
    ![
      'SAVE_NOTE',
      'CONFIRM_PAYMENT',
      'CANCEL_PAYMENT',
      'PROCESS',
      'READY',
      'SHIP',
      'DELIVER',
      'CANCEL',
    ].includes(action)
  )
    return { error: 'Choose an available order action.', message: '' };
  if (note.length > 2000)
    return { error: 'Internal notes must be 2,000 characters or fewer.', message: '' };
  const { error } = await workspace.supabase.rpc('update_order_status', {
    target_tenant: workspace.tenant.id,
    target_order: orderId,
    order_action: action,
    note,
  });
  if (error) return { error: commerceErrorMessage(error.message), message: '' };
  revalidatePath(`/t/${slug}/orders`);
  revalidatePath(`/t/${slug}/orders/${orderId}`);
  return { error: '', message: 'Order updated.' };
}

export async function updateOrderNote(
  slug: string,
  orderId: string,
  _state: CommerceActionState,
  form: FormData,
) {
  return runOrderAction(slug, orderId, 'SAVE_NOTE', String(form.get('internalNote') ?? '').trim());
}

export async function performOrderAction(
  slug: string,
  orderId: string,
  orderAction: string,
  _state: CommerceActionState,
  _form: FormData,
) {
  return runOrderAction(slug, orderId, orderAction, '');
}
