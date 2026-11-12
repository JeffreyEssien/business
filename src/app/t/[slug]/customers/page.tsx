import { CustomerList } from '@/components/commerce/customer-list';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Panel } from '@/components/ui/panel';
import { getCustomersWorkspace } from '@/modules/commerce/queries';
import { CUSTOMER_PAGE_SIZE } from '@/modules/commerce/types';
import styles from '@/components/commerce/order-admin.module.css';

export const metadata = { title: 'Customers' };

// getTenantWorkspace (inside the query) enforces active membership; RLS limits
// the read to this tenant's customers.
export default async function CustomersPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const { slug } = await params;
  const filters = await searchParams;
  const data = await getCustomersWorkspace(slug, {
    page: Number(filters.page) || 1,
    search: filters.search,
  });
  const address = (page: number) =>
    `/t/${slug}/customers?${new URLSearchParams({
      page: String(page),
      ...(data.search && { search: data.search }),
    })}`;
  return (
    <main className="tenant-home">
      <PageHeader
        eyebrow="CUSTOMERS"
        title="Your customers"
        description="Everyone who has ordered from your store, with how often they buy and how much they have paid."
      />
      <Panel
        title="Customers"
        description={`${data.total} ${data.total === 1 ? 'customer' : 'customers'}${data.search ? ' matching your search' : ''}`}
        padded={false}
      >
        <form className={styles.filters}>
          <input
            name="search"
            aria-label="Search customers"
            placeholder="Search name, email, or phone"
            defaultValue={data.search}
          />
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
        <CustomerList
          customers={data.customers}
          currency={data.currency}
          searching={Boolean(data.search)}
        />
        <Pagination
          total={data.total}
          page={data.page}
          pageSize={CUSTOMER_PAGE_SIZE}
          href={address}
        />
      </Panel>
    </main>
  );
}
