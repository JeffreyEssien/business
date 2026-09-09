'use client';
import { useEffect, useState } from 'react';
import type { PublicProduct } from '@/modules/catalog/types';
import { addCartLine } from '@/modules/commerce/cart';
import styles from './commerce.module.css';

export function AddToCartButton({ slug, product }: { slug: string; product: PublicProduct }) {
  const [added, setAdded] = useState(false);
  const available = !product.trackInventory || product.stockQuantity > 0;
  useEffect(() => {
    if (!added) return;
    const timeout = window.setTimeout(() => setAdded(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [added]);
  return (
    <button
      className={styles.addButton}
      type="button"
      disabled={!available}
      onClick={() => {
        addCartLine(slug, {
          productId: product.id,
          name: product.name,
          slug: product.slug,
          unitPrice: product.price,
          currency: product.currency,
          mediaUrl: product.mediaUrl,
        });
        setAdded(true);
      }}
    >
      {!available ? 'Out of stock' : added ? 'Added to cart ✓' : 'Add to cart'}
    </button>
  );
}
