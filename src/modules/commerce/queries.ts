import 'server-only';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getTenantWorkspace } from '@/modules/tenants/workspace-query';
import {
  FULFILLMENT_STATUSES,
  ORDER_PAGE_SIZE,
  PAYMENT_STATUSES,
  type PaymentAttempt,
  type PublicPaystackOrder,
  type CheckoutSettings,
  type OrderDetail,
  type OrderItem,
  type OrderSummary,
  type StoredBankAccount,
  type StoredShippingRate,
  type TenantPaymentSettings,
} from './types';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getPublicPaystackOrder(slug: string, reference: string, accessToken: string) {
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
    !/^BC-[A-Z0-9-]{8,40}$/.test(reference) ||
    !uuidPattern.test(accessToken)
  )
    return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_public_paystack_order', {
    store_slug: slug,
    order_reference: reference,
    access_token: accessToken,
  });
  if (error || !data) return null;
  return data as PublicPaystackOrder;
}

export async function getOrdersWorkspace(
  slug: string,
  filters: { page?: number; search?: string; payment?: string; fulfillment?: string } = {},
) {
  const workspace = await getTenantWorkspace(slug);
  const page = Math.max(1, filters.page ?? 1);
  const search = (filters.search ?? '')
    .replace(/[%_\\]/g, '')
    .trim()
    .slice(0, 100);
  const payment = PAYMENT_STATUSES.includes(filters.payment as (typeof PAYMENT_STATUSES)[number])
    ? filters.payment
    : '';
  const fulfillment = FULFILLMENT_STATUSES.includes(
    filters.fulfillment as (typeof FULFILLMENT_STATUSES)[number],
  )
    ? filters.fulfillment
    : '';
  let query = workspace.supabase
    .from('orders')
    .select(
      'id,reference,customer_name_snapshot,total,currency,payment_status,fulfillment_status,created_at',
      {
        count: 'exact',
      },
    )
    .eq('tenant_id', workspace.tenant.id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });
  if (search)
    query = query.or(`reference.ilike.%${search}%,customer_name_snapshot.ilike.%${search}%`);
  if (payment) query = query.eq('payment_status', payment);
  if (fulfillment) query = query.eq('fulfillment_status', fulfillment);
  const { data, error, count } = await query.range(
    (page - 1) * ORDER_PAGE_SIZE,
    page * ORDER_PAGE_SIZE - 1,
  );
  if (error) throw new Error('Orders could not be loaded.');
  return {
    ...workspace,
    orders: (data ?? []) as OrderSummary[],
    total: count ?? 0,
    page,
    search,
    payment,
    fulfillment,
  };
}

export async function getOrderDetail(slug: string, orderId: string) {
  const workspace = await getTenantWorkspace(slug);
  const [orderResult, itemResult, paymentResult] = await Promise.all([
    workspace.supabase
      .from('orders')
      .select(
        'id,reference,customer_name_snapshot,customer_email_snapshot,customer_phone_snapshot,subtotal,delivery_fee,total,currency,payment_method,payment_status,fulfillment_status,shipping_address_jsonb,delivery_method_snapshot,delivery_instructions_snapshot,payment_instructions_snapshot,customer_note,internal_note,created_at,paid_at,fulfilled_at',
      )
      .eq('tenant_id', workspace.tenant.id)
      .eq('id', orderId)
      .maybeSingle(),
    workspace.supabase
      .from('order_items')
      .select('id,product_name_snapshot,sku_snapshot,unit_price,quantity,line_total')
      .eq('tenant_id', workspace.tenant.id)
      .eq('order_id', orderId)
      .order('created_at'),
    workspace.supabase
      .from('payments')
      .select('id,provider_reference,status,amount,currency,failure_code,initiated_at,paid_at')
      .eq('tenant_id', workspace.tenant.id)
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);
  if (orderResult.error || itemResult.error || paymentResult.error)
    throw new Error('Order details could not be loaded.');
  if (!orderResult.data) notFound();
  return {
    ...workspace,
    order: orderResult.data as OrderDetail,
    items: (itemResult.data ?? []) as OrderItem[],
    payments: (paymentResult.data ?? []) as PaymentAttempt[],
  };
}

export async function getCheckoutWorkspace(slug: string) {
  const workspace = await getTenantWorkspace(slug);
  const [settingsResult, bankResult, ratesResult, paymentResult] = await Promise.all([
    workspace.supabase
      .from('tenant_checkout_settings')
      .select(
        'collect_phone,collect_email,collect_delivery_address,order_notes_enabled,bank_transfer_enabled,paystack_enabled,success_message',
      )
      .eq('tenant_id', workspace.tenant.id)
      .single(),
    workspace.supabase
      .from('tenant_bank_accounts')
      .select('bank_name,account_number,account_name,instructions')
      .eq('tenant_id', workspace.tenant.id)
      .eq('is_active', true)
      .maybeSingle(),
    workspace.supabase
      .from('shipping_rates')
      .select('id,name,amount,rule_jsonb,shipping_zones!inner(name)')
      .eq('tenant_id', workspace.tenant.id)
      .eq('status', 'ACTIVE')
      .order('amount'),
    workspace.supabase
      .from('tenant_payment_settings')
      .select(
        'connection_status,subaccount_code,settlement_bank_code,settlement_bank_name,settlement_account_last4,settlement_account_name,connected_at',
      )
      .eq('tenant_id', workspace.tenant.id)
      .single(),
  ]);
  if (settingsResult.error || bankResult.error || ratesResult.error || paymentResult.error)
    throw new Error('Checkout settings could not be loaded.');
  return {
    ...workspace,
    settings: {
      ...settingsResult.data,
      paystack_account_ready: paymentResult.data.connection_status === 'ACTIVE',
    } as CheckoutSettings,
    bankAccount: bankResult.data as StoredBankAccount | null,
    shippingRates: (ratesResult.data ?? []) as unknown as StoredShippingRate[],
    paymentSettings: paymentResult.data as TenantPaymentSettings,
  };
}
