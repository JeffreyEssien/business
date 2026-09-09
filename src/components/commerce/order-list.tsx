import Link from 'next/link';
import { EmptyState } from '@/components/ui/empty-state';
import { formatMoney } from '@/modules/commerce/money';
import type { OrderSummary } from '@/modules/commerce/types';
import styles from './order-admin.module.css';

export function statusLabel(value: string) {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^./, (letter) => letter.toUpperCase());
}

export function OrderStatus({ value }: { value: string }) {
  return (
    <span className={`${styles.status} ${styles[`status${value}`] ?? ''}`}>
      ● {statusLabel(value)}
    </span>
  );
}

export function OrderList({ slug, orders }: { slug: string; orders: OrderSummary[] }) {
  if (!orders.length)
    return (
      <EmptyState
        title="No matching orders"
        description="New customer orders will appear here. Change the filters if you are looking for an older order."
      />
    );
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Total</th>
            <th>Payment</th>
            <th>Fulfilment</th>
            <th>Received</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>
                <Link className={styles.orderLink} href={`/t/${slug}/orders/${order.id}`}>
                  {order.reference}
                </Link>
              </td>
              <td>{order.customer_name_snapshot}</td>
              <td>{formatMoney(order.total, order.currency)}</td>
              <td>
                <OrderStatus value={order.payment_status} />
              </td>
              <td>
                <OrderStatus value={order.fulfillment_status} />
              </td>
              <td>
                {new Intl.DateTimeFormat('en-NG', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(order.created_at))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
