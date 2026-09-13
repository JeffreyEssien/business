'use client';

import { useState } from 'react';
import styles from '@/components/catalog/catalog.module.css';

export function ProductSearchForm({ defaultValue = '' }: { defaultValue?: string }) {
  const [searching, setSearching] = useState(false);
  return (
    <form className={styles.publicSearch} onSubmit={() => setSearching(true)}>
      <label htmlFor="shop-search">Search this store&apos;s products</label>
      <div>
        <input
          id="shop-search"
          name="search"
          type="search"
          maxLength={100}
          defaultValue={defaultValue}
          placeholder="What are you looking for?"
        />
        <button type="submit" disabled={searching}>
          {searching ? 'Searching…' : 'Search products'}
        </button>
      </div>
    </form>
  );
}
