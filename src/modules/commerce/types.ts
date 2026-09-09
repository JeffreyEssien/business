import type { SiteConfiguration } from '@/modules/content/types';

export const ORDER_PAGE_SIZE = 20;
export const PAYMENT_STATUSES = [
  'PENDING',
  'AWAITING_VERIFICATION',
  'AUTHORIZED',
  'PAID',
  'FAILED',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'CANCELLED',
] as const;
export const FULFILLMENT_STATUSES = [
  'NEW',
  'PROCESSING',
  'READY',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];
export type CartLine = { productId: string; quantity: number };
export type StoredCartLine = CartLine & {
  name: string;
  slug: string;
  unitPrice: number;
  currency: string;
  mediaUrl: string | null;
};
export type CheckoutItem = StoredCartLine & {
  available: boolean;
  maximumQuantity: number;
};
export type ShippingRate = {
  id: string;
  name: string;
  zoneName: string;
  amount: number;
  isPickup: boolean;
  states: string[];
};
export type CheckoutQuote = {
  tenant: { name: string; slug: string };
  site: SiteConfiguration;
  settings: {
    collectPhone: boolean;
    collectEmail: boolean;
    collectDeliveryAddress: boolean;
    orderNotesEnabled: boolean;
    bankTransferEnabled: boolean;
    successMessage: string;
  };
  items: CheckoutItem[];
  shippingRates: ShippingRate[];
};
export type BankAccount = {
  bankName: string;
  accountNumber: string;
  accountName: string;
  instructions: string;
};
export type CreatedOrder = {
  orderId: string;
  reference: string;
  accessToken: string;
  storeName: string;
  currency: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  successMessage: string;
  bankAccount: BankAccount;
};
export type OrderSummary = {
  id: string;
  reference: string;
  customer_name_snapshot: string;
  total: number;
  currency: string;
  payment_status: PaymentStatus;
  fulfillment_status: FulfillmentStatus;
  created_at: string;
};
export type OrderDetail = OrderSummary & {
  subtotal: number;
  delivery_fee: number;
  customer_email_snapshot: string;
  customer_phone_snapshot: string;
  shipping_address_jsonb: Record<string, string>;
  delivery_method_snapshot: string;
  delivery_instructions_snapshot: string;
  payment_instructions_snapshot: {
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
    instructions?: string;
  };
  customer_note: string;
  internal_note: string;
  paid_at: string | null;
  fulfilled_at: string | null;
};
export type OrderItem = {
  id: string;
  product_name_snapshot: string;
  sku_snapshot: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
};
export type CheckoutSettings = {
  collect_phone: boolean;
  collect_email: boolean;
  collect_delivery_address: boolean;
  order_notes_enabled: boolean;
  bank_transfer_enabled: boolean;
  success_message: string;
};
export type StoredBankAccount = {
  bank_name: string;
  account_number: string;
  account_name: string;
  instructions: string;
};
export type StoredShippingRate = {
  id: string;
  name: string;
  amount: number;
  rule_jsonb: { states?: string[]; pickup?: boolean };
  shipping_zones: { name: string } | { name: string }[] | null;
};
