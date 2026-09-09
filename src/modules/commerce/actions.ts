'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getTenantWorkspace } from '@/modules/tenants/workspace-query';
import type { CartLine, CheckoutQuote, CreatedOrder } from './types';
import { commerceErrorMessage, parseCart, validateCheckout } from './validation';

export type CheckoutActionState = { error: string; order: CreatedOrder | null };
export type CommerceActionState = { error: string; message: string };

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
    payment_choice: 'BANK_TRANSFER',
    customer_note: validation.input.note,
  });
  if (error) return { error: commerceErrorMessage(error.message), order: null };
  return { error: '', order: data as CreatedOrder };
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
  const { error } = await workspace.supabase.rpc('save_checkout_settings', {
    target_tenant: workspace.tenant.id,
    phone_required: form.get('collectPhone') === 'on',
    email_required: form.get('collectEmail') === 'on',
    address_required: form.get('collectAddress') === 'on',
    notes_enabled: form.get('orderNotes') === 'on',
    transfer_enabled: form.get('bankTransfer') === 'on',
    confirmation_message: message,
  });
  if (error) return { error: commerceErrorMessage(error.message), message: '' };
  revalidatePath(`/t/${slug}/orders/settings`);
  return { error: '', message: 'Checkout choices saved.' };
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
