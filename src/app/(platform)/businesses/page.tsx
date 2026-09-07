import { BusinessList } from '@/components/super-admin/business-list';
import { BusinessFilters } from '@/components/businesses/business-filters';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { ButtonLink } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { listBusinesses } from '@/modules/tenants/queries';
import { BUSINESS_PAGE_SIZE } from '@/modules/tenants/constants';
export const metadata = { title: 'Businesses' };
export default async function BusinessesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const search = typeof params.q === 'string' ? params.q : '';
  const status = typeof params.status === 'string' ? params.status : '';
  const page = Math.min(100000, Math.max(1, Math.floor(Number(params.page) || 1)));
  const { businesses, count } = await listBusinesses(search, status, page);
  const pageLink = (nextPage: number) =>
    `/businesses?${new URLSearchParams({ q: search, status, page: String(nextPage) })}`;
  return (
    <>
      <PageHeader
        eyebrow="YOUR PLATFORM COMMUNITY"
        title="Businesses"
        description="One workspace for every brand you help bring online."
        action={<ButtonLink href="/businesses/new">Create business ＋</ButtonLink>}
      />
      <Panel
        title={`All businesses (${count})`}
        description="Live records from your platform."
        padded={false}
      >
        <BusinessFilters search={search} status={status} />
        <BusinessList businesses={businesses} />
        <Pagination total={count} page={page} pageSize={BUSINESS_PAGE_SIZE} href={pageLink} />
      </Panel>
    </>
  );
}
