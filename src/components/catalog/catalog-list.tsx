import Link from 'next/link';
import { removeProduct } from '@/modules/catalog/actions';
import type { Product } from '@/modules/catalog/types';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import styles from './catalog.module.css';

export function CatalogList({ slug, products }: { slug: string; products: Product[] }) {
  if (!products.length)
    return (
      <EmptyState
        title="Add your first product"
        description="Products can stay in draft until their details, inventory, and image are ready."
        action={<ButtonLink href={`/t/${slug}/catalog/products/new`}>Create product</ButtonLink>}
      />
    );
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Status</th>
            <th>Price</th>
            <th>Inventory</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              <td>
                <Link
                  className={styles.tableLink}
                  href={`/t/${slug}/catalog/products/${product.id}/edit`}
                >
                  {product.name}
                </Link>
                <div className={styles.muted}>{product.sku || product.slug}</div>
              </td>
              <td>{product.status}</td>
              <td>
                {new Intl.NumberFormat('en-NG', {
                  style: 'currency',
                  currency: product.currency,
                }).format(product.price)}
              </td>
              <td>{product.track_inventory ? product.stock_quantity : 'Not tracked'}</td>
              <td>
                <div className={styles.rowActions}>
                  <Link
                    className={styles.tableLink}
                    href={`/t/${slug}/catalog/products/${product.id}/edit`}
                  >
                    Edit
                  </Link>
                  <form action={removeProduct.bind(null, slug, product.id)}>
                    <button className={styles.dangerButton} type="submit">
                      Delete
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
