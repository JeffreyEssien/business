import { EmptyState } from '@/components/ui/empty-state';
import { formatMoney } from '@/modules/commerce/money';
import type { CustomerSummary } from '@/modules/commerce/types';

const dateFormat = new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium' });

export function CustomerList({
  customers,
  currency,
  searching,
}: {
  customers: CustomerSummary[];
  currency: string;
  searching: boolean;
}) {
  if (!customers.length)
    return (
      <EmptyState
        title={searching ? 'No matching customers' : 'No customers yet'}
        description={
          searching
            ? 'Try a different name, email address, or phone number.'
            : 'Everyone who places an order in your store will be listed here automatically.'
        }
      />
    );
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Customer</th>
            <th>Contact</th>
            <th>Orders</th>
            <th>Paid spend</th>
            <th>Last order</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((customer) => (
            <tr key={customer.id}>
              <td>{customer.name}</td>
              <td>
                {[customer.email, customer.phone].filter(Boolean).join(' · ') || 'Not provided'}
              </td>
              <td>{customer.total_orders_cached}</td>
              <td>{formatMoney(customer.total_spent_cached, currency)}</td>
              <td>
                {customer.last_order_at
                  ? dateFormat.format(new Date(customer.last_order_at))
                  : 'No orders yet'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
