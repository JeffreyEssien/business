import { WorkspaceNavigation } from '@/components/catalog/workspace-navigation';
import { OrderList } from '@/components/commerce/order-list';
import { Button, ButtonLink } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Panel } from '@/components/ui/panel';
import { getOrdersWorkspace } from '@/modules/commerce/queries';
import { FULFILLMENT_STATUSES, ORDER_PAGE_SIZE, PAYMENT_STATUSES } from '@/modules/commerce/types';
import styles from '@/components/commerce/order-admin.module.css';

export const metadata = { title: 'Orders' };
export default async function OrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; search?: string; payment?: string; fulfillment?: string }>;
}) {
  const { slug } = await params;
  const filters = await searchParams;
  const data = await getOrdersWorkspace(slug, {
    page: Number(filters.page) || 1,
    search: filters.search,
    payment: filters.payment,
    fulfillment: filters.fulfillment,
  });
  const address = (page: number) =>
    `/t/${slug}/orders?${new URLSearchParams({ page: String(page), ...(data.search && { search: data.search }), ...(data.payment && { payment: data.payment }), ...(data.fulfillment && { fulfillment: data.fulfillment }) })}`;
  return (
    <main className="tenant-home">
      <WorkspaceNavigation name={data.tenant.name} slug={slug} />
      <PageHeader
        eyebrow="ORDERS"
        title="Customer orders"
        description="Review payment notices, prepare orders, and keep customers' fulfilment status accurate."
        action={
          <ButtonLink href={`/t/${slug}/orders/settings`} variant="secondary">
            Checkout settings
          </ButtonLink>
        }
      />
      <Panel
        title="Orders"
        description={`${data.total} matching ${data.total === 1 ? 'order' : 'orders'}`}
        padded={false}
      >
        <form className={styles.filters}>
          <input
            name="search"
            aria-label="Search orders"
            placeholder="Search order reference or customer"
            defaultValue={data.search}
          />
          <select name="payment" aria-label="Filter by payment status" defaultValue={data.payment}>
            <option value="">Every payment status</option>
            {PAYMENT_STATUSES.map((status) => (
              <option value={status} key={status}>
                {status.toLowerCase().replaceAll('_', ' ')}
              </option>
            ))}
          </select>
          <select
            name="fulfillment"
            aria-label="Filter by fulfilment status"
            defaultValue={data.fulfillment}
          >
            <option value="">Every fulfilment status</option>
            {FULFILLMENT_STATUSES.map((status) => (
              <option value={status} key={status}>
                {status.toLowerCase()}
              </option>
            ))}
          </select>
          <Button type="submit" variant="secondary">
            Apply filters
          </Button>
        </form>
        <OrderList slug={slug} orders={data.orders} />
        <Pagination total={data.total} page={data.page} pageSize={ORDER_PAGE_SIZE} href={address} />
      </Panel>
    </main>
  );
}
