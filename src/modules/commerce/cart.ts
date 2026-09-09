'use client';
import type { StoredCartLine } from './types';

export const CART_CHANGED_EVENT = 'businesscare:cart-changed';

function cartKey(slug: string) {
  return `businesscare:cart:${slug}`;
}

export function readCart(slug: string): StoredCartLine[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(cartKey(slug)) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (line): line is StoredCartLine =>
        Boolean(line) &&
        typeof line === 'object' &&
        typeof line.productId === 'string' &&
        typeof line.name === 'string' &&
        typeof line.slug === 'string' &&
        typeof line.unitPrice === 'number' &&
        typeof line.currency === 'string' &&
        Number.isInteger(line.quantity) &&
        line.quantity > 0 &&
        line.quantity <= 99,
    );
  } catch {
    return [];
  }
}

export function saveCart(slug: string, lines: StoredCartLine[]) {
  localStorage.setItem(cartKey(slug), JSON.stringify(lines.slice(0, 50)));
  window.dispatchEvent(new CustomEvent(CART_CHANGED_EVENT, { detail: { slug } }));
}

export function addCartLine(slug: string, incoming: Omit<StoredCartLine, 'quantity'>) {
  const lines = readCart(slug);
  const existing = lines.find((line) => line.productId === incoming.productId);
  if (existing) existing.quantity = Math.min(99, existing.quantity + 1);
  else lines.push({ ...incoming, quantity: 1 });
  saveCart(slug, lines);
}
