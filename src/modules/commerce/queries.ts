import 'server-only';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getTenantWorkspace } from '@/modules/tenants/workspace-query';
import {
  FULFILLMENT_STATUSES,
  CUSTOMER_PAGE_SIZE,
  ORDER_PAGE_SIZE,
  PAYMENT_STATUSES,
  type PaymentAttempt,
  type PublicPaystackOrder,
  type CheckoutSettings,
  type CustomerSummary,
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

/** Strips PostgREST filter wildcards so search text can only match literally. */
function searchText(value?: string) {
  return (value ?? '')
    .replace(/[%_\\,()]/g, '')
    .trim()
    .slice(0, 100);
}

export async function getCustomersWorkspace(
  slug: string,
  filters: { page?: number; search?: string } = {},
) {
  const workspace = await getTenantWorkspace(slug);
  const page = Math.max(1, filters.page ?? 1);
  const search = searchText(filters.search);
  let query = workspace.supabase
    .from('customers')
    .select('id,name,email,phone,total_orders_cached,total_spent_cached,last_order_at,created_at', {
      count: 'exact',
    })
    .eq('tenant_id', workspace.tenant.id)
    .order('last_order_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false });
  if (search)
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
  // Customers and the store currency are independent reads; run them together.
  const [customers, tenant] = await Promise.all([
    query.range((page - 1) * CUSTOMER_PAGE_SIZE, page * CUSTOMER_PAGE_SIZE - 1),
    workspace.supabase
      .from('tenants')
      .select('default_currency')
      .eq('id', workspace.tenant.id)
      .single(),
  ]);
  if (customers.error || tenant.error) throw new Error('Customers could not be loaded.');
  return {
    ...workspace,
    customers: (customers.data ?? []).map((customer) => ({
      ...customer,
      total_orders_cached: Number(customer.total_orders_cached),
      total_spent_cached: Number(customer.total_spent_cached),
    })) as CustomerSummary[],
    currency: tenant.data.default_currency as string,
    total: customers.count ?? 0,
    page,
    search,
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
      .select(
        'id,provider_reference,status,provider_status,order_application_status,resolution_status,amount,currency,failure_code,initiated_at,paid_at',
      )
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
