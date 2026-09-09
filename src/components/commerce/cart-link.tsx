'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CART_CHANGED_EVENT, readCart } from '@/modules/commerce/cart';

export function CartLink({ slug }: { slug: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const refresh = () =>
      setCount(readCart(slug).reduce((total, line) => total + line.quantity, 0));
    refresh();
    const changed = (event: Event) => {
      const detail = (event as CustomEvent<{ slug?: string }>).detail;
      if (!detail?.slug || detail.slug === slug) refresh();
    };
    window.addEventListener(CART_CHANGED_EVENT, changed);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(CART_CHANGED_EVENT, changed);
      window.removeEventListener('storage', refresh);
    };
  }, [slug]);
  return <Link href={`/store/${slug}/cart`}>Cart{count ? ` (${count})` : ''}</Link>;
}
