import 'server-only';
import { notFound } from 'next/navigation';
import { getTenantWorkspace } from '@/modules/tenants/workspace-query';
import {
  FULFILLMENT_STATUSES,
  ORDER_PAGE_SIZE,
  PAYMENT_STATUSES,
  type CheckoutSettings,
  type OrderDetail,
  type OrderItem,
  type OrderSummary,
  type StoredBankAccount,
  type StoredShippingRate,
} from './types';

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
  const [orderResult, itemResult] = await Promise.all([
    workspace.supabase
      .from('orders')
      .select(
        'id,reference,customer_name_snapshot,customer_email_snapshot,customer_phone_snapshot,subtotal,delivery_fee,total,currency,payment_status,fulfillment_status,shipping_address_jsonb,delivery_method_snapshot,delivery_instructions_snapshot,payment_instructions_snapshot,customer_note,internal_note,created_at,paid_at,fulfilled_at',
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
  ]);
  if (orderResult.error || itemResult.error) throw new Error('Order details could not be loaded.');
  if (!orderResult.data) notFound();
  return {
    ...workspace,
    order: orderResult.data as OrderDetail,
    items: (itemResult.data ?? []) as OrderItem[],
  };
}

export async function getCheckoutWorkspace(slug: string) {
  const workspace = await getTenantWorkspace(slug);
  const [settingsResult, bankResult, ratesResult] = await Promise.all([
    workspace.supabase
      .from('tenant_checkout_settings')
      .select(
        'collect_phone,collect_email,collect_delivery_address,order_notes_enabled,bank_transfer_enabled,success_message',
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
  ]);
  if (settingsResult.error || bankResult.error || ratesResult.error)
    throw new Error('Checkout settings could not be loaded.');
  return {
    ...workspace,
    settings: settingsResult.data as CheckoutSettings,
    bankAccount: bankResult.data as StoredBankAccount | null,
    shippingRates: (ratesResult.data ?? []) as unknown as StoredShippingRate[],
  };
}
