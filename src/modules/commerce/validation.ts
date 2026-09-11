import type { CartLine } from './types';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function text(form: FormData, name: string, maximum: number) {
  return String(form.get(name) ?? '')
    .trim()
    .slice(0, maximum + 1);
}

export function parseCart(value: unknown): CartLine[] | null {
  try {
    const parsed = typeof value === 'string' ? (JSON.parse(value) as unknown) : value;
    if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 50) return null;
    const seen = new Set<string>();
    const lines: CartLine[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') return null;
      const productId = String((item as { productId?: unknown }).productId ?? '');
      const quantity = Number((item as { quantity?: unknown }).quantity);
      if (
        !uuidPattern.test(productId) ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 99
      )
        return null;
      if (seen.has(productId)) return null;
      seen.add(productId);
      lines.push({ productId, quantity });
    }
    return lines;
  } catch {
    return null;
  }
}

export function validateCheckout(form: FormData) {
  const cart = parseCart(form.get('cart'));
  const name = text(form, 'name', 160);
  const email = text(form, 'email', 254).toLowerCase();
  const phone = text(form, 'phone', 40);
  const addressLine1 = text(form, 'addressLine1', 240);
  const addressLine2 = text(form, 'addressLine2', 240);
  const city = text(form, 'city', 100);
  const state = text(form, 'state', 100);
  const postalCode = text(form, 'postalCode', 30);
  const country = text(form, 'country', 2).toUpperCase() || 'NG';
  const shippingRate = text(form, 'shippingRate', 36);
  const paymentChoice = text(form, 'paymentChoice', 20).toUpperCase();
  const note = text(form, 'note', 1000);
  if (!cart) return { error: 'Your cart could not be read. Review it and try again.' };
  if (!name) return { error: 'Enter the name the store should use for this order.' };
  if (shippingRate && !uuidPattern.test(shippingRate))
    return { error: 'Choose an available delivery or pickup option.' };
  if (!['BANK_TRANSFER', 'PAYSTACK'].includes(paymentChoice))
    return { error: 'Choose how you would like to pay.' };
  return {
    input: {
      cart,
      customer: { name, email, phone },
      address: { addressLine1, addressLine2, city, state, postalCode, country },
      shippingRate: shippingRate || null,
      paymentChoice,
      note,
    },
  };
}

export function commerceErrorMessage(message: string) {
  const messages: Record<string, string> = {
    INVALID_CART: 'Your cart is not valid. Review the products and try again.',
    DUPLICATE_CART_ITEM: 'A product appears more than once. Refresh your cart and try again.',
    STORE_UNAVAILABLE: 'This store is not accepting orders right now.',
    CHECKOUT_UNAVAILABLE: 'Checkout is not available for this store right now.',
    PAYMENT_METHOD_UNAVAILABLE: 'That payment method is not available. Choose another option.',
    INVALID_CUSTOMER_DETAILS: 'Check your name and contact details, then try again.',
    DELIVERY_METHOD_REQUIRED: 'Choose how you would like to receive your order.',
    DELIVERY_METHOD_UNAVAILABLE: 'That delivery option is not available for this address.',
    INVALID_DELIVERY_ADDRESS: 'Enter a complete delivery address.',
    PRODUCT_UNAVAILABLE: 'One or more products are no longer available.',
    PRODUCT_OUT_OF_STOCK: 'The requested quantity is no longer in stock. Review your cart.',
    MIXED_CURRENCY_CART: 'These products cannot be ordered together. Contact the store for help.',
    ORDER_NOT_FOUND: 'That order could not be found.',
    INVALID_ORDER_TRANSITION: 'That order cannot move to the selected status yet.',
    BANK_ACCOUNT_REQUIRED: 'Save a bank account before turning on bank-transfer checkout.',
    PAYSTACK_ACCOUNT_REQUIRED:
      'Connect a settlement account before turning on secure online payment.',
    PAYMENT_RETRY_UNAVAILABLE: 'Please wait before trying this payment again.',
  };
  return (
    Object.entries(messages).find(([code]) => message.includes(code))?.[1] ??
    'We could not complete that request. Check the details and try again.'
  );
}
