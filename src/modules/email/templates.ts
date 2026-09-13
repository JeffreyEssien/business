import 'server-only';
import type { EmailEventType, EmailNotificationContext } from './types';

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : '#6655d7';
}

function safeHttpsImage(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function applicationUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return new URL(path, base).toString();
}

function money(amount: number, currency: string) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currency || 'NGN',
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);
}

const eventCopy: Record<
  Exclude<EmailEventType, 'OWNER_INVITATION'>,
  { eyebrow: string; heading: string; body: string }
> = {
  ORDER_RECEIVED: {
    eyebrow: 'ORDER RECEIVED',
    heading: 'Thank you for your order.',
    body: 'We have received your order and will keep you informed as it moves forward.',
  },
  PAYMENT_RECEIVED: {
    eyebrow: 'PAYMENT RECEIVED',
    heading: 'Your payment is confirmed.',
    body: 'Your payment has been verified and your order is moving forward.',
  },
  ORDER_READY: {
    eyebrow: 'ORDER READY',
    heading: 'Your order is ready.',
    body: 'Your order is ready for the delivery or pickup arrangement shown below.',
  },
  ORDER_SHIPPED: {
    eyebrow: 'ORDER ON THE WAY',
    heading: 'Your order has been shipped.',
    body: 'Your order is now on its way. Keep this email for your order reference.',
  },
  ORDER_DELIVERED: {
    eyebrow: 'ORDER DELIVERED',
    heading: 'Your order has been delivered.',
    body: 'Thank you for choosing us. We hope you enjoy your order.',
  },
};

function rows(context: EmailNotificationContext) {
  return context.items
    .map(
      (item) => `<tr>
        <td style="padding:12px 0;border-bottom:1px solid #e7e7ec;color:#272732">${escapeHtml(item.name)} × ${item.quantity}</td>
        <td style="padding:12px 0;border-bottom:1px solid #e7e7ec;text-align:right;color:#272732">${escapeHtml(money(item.lineTotal, context.order?.currency ?? 'NGN'))}</td>
      </tr>`,
    )
    .join('');
}

export function renderTransactionalEmail(context: EmailNotificationContext) {
  const brand = context.templateData;
  const businessName = brand.businessName || 'BusinessCare store';
  const primary = safeColor(brand.primaryColor);
  const logo = safeHttpsImage(brand.logoUrl);
  const invitation = context.eventType === 'OWNER_INVITATION';
  const copy =
    context.eventType === 'OWNER_INVITATION'
      ? {
          eyebrow: 'BUSINESS INVITATION',
          heading: `You are invited to manage ${businessName}.`,
          body: 'BusinessCare gives you one workspace for your store, products, orders, payments, website, and customer communication.',
        }
      : eventCopy[context.eventType];
  const actionUrl = invitation
    ? (brand.invitationUrl ?? '')
    : applicationUrl(`/store/${encodeURIComponent(brand.storeSlug)}`);
  const actionLabel = invitation ? 'Accept your invitation' : 'Visit the store';
  const order = context.order;
  const orderSection = order
    ? `<div style="margin:28px 0;padding:20px;border:1px solid #e7e7ec;border-radius:12px;background:#fafafd">
        <p style="margin:0 0 6px;color:#737386;font-size:12px;text-transform:uppercase;letter-spacing:.08em">Order reference</p>
        <p style="margin:0 0 18px;color:#272732;font-size:18px;font-weight:700">${escapeHtml(order.reference)}</p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">${rows(context)}</table>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:16px;border-collapse:collapse">
          <tr><td style="padding:4px 0;color:#737386">Delivery</td><td style="padding:4px 0;text-align:right;color:#272732">${escapeHtml(money(order.deliveryFee, order.currency))}</td></tr>
          <tr><td style="padding:8px 0 0;font-weight:700;color:#272732">Total</td><td style="padding:8px 0 0;text-align:right;font-weight:700;color:#272732">${escapeHtml(money(order.total, order.currency))}</td></tr>
        </table>
        <p style="margin:18px 0 0;color:#737386;font-size:13px">${escapeHtml(order.deliveryMethod)}${order.deliveryInstructions ? ` · ${escapeHtml(order.deliveryInstructions)}` : ''}</p>
      </div>`
    : '';
  const logoBlock = logo
    ? `<img src="${escapeHtml(logo)}" width="52" height="52" alt="${escapeHtml(businessName)} logo" style="display:block;max-width:52px;max-height:52px;object-fit:contain;margin-bottom:18px" />`
    : `<div style="width:44px;height:44px;border-radius:10px;background:${primary};color:#fff;line-height:44px;text-align:center;font-weight:700;margin-bottom:18px">${escapeHtml(businessName.charAt(0).toUpperCase())}</div>`;
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#f5f6f8;font-family:Arial,sans-serif;color:#272732">
    <div style="display:none;max-height:0;overflow:hidden">${escapeHtml(copy.body)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:32px 12px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e7e7ec;border-radius:16px">
        <tr><td style="padding:36px">${logoBlock}
          <p style="margin:0 0 12px;color:${primary};font-size:12px;font-weight:700;letter-spacing:.12em">${escapeHtml(copy.eyebrow)}</p>
          <h1 style="margin:0 0 14px;font-size:28px;line-height:1.2;color:#272732">${escapeHtml(copy.heading)}</h1>
          <p style="margin:0;color:#66667a;font-size:16px;line-height:1.65">${escapeHtml(copy.body)}</p>
          ${orderSection}
          <a href="${escapeHtml(actionUrl)}" style="display:inline-block;margin-top:28px;padding:14px 20px;border-radius:9px;background:${primary};color:#fff;text-decoration:none;font-weight:700">${actionLabel}</a>
          <p style="margin:32px 0 0;padding-top:22px;border-top:1px solid #e7e7ec;color:#89899a;font-size:12px;line-height:1.6">Sent for ${escapeHtml(businessName)} through BusinessCare. Reply to this email if you need help with your order.</p>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;
  const lines = [copy.eyebrow, copy.heading, copy.body];
  if (order) {
    lines.push(`Order reference: ${order.reference}`);
    for (const item of context.items)
      lines.push(`${item.name} × ${item.quantity}: ${money(item.lineTotal, order.currency)}`);
    lines.push(`Delivery: ${money(order.deliveryFee, order.currency)}`);
    lines.push(`Total: ${money(order.total, order.currency)}`);
  }
  lines.push(`${actionLabel}: ${actionUrl}`, `Sent for ${businessName} through BusinessCare.`);
  return { html, text: lines.join('\n\n') };
}
