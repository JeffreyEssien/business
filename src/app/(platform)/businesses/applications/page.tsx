import { ApplicationFilters } from '@/components/applications/application-filters';
import { ApplicationList } from '@/components/applications/application-list';
import { ButtonLink } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Panel } from '@/components/ui/panel';
import { APPLICATION_PAGE_SIZE, listApplications } from '@/modules/applications/queries';

export const metadata = { title: 'Business applications' };

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const search = typeof params.q === 'string' ? params.q : '';
  const status = typeof params.status === 'string' ? params.status : '';
  const page = Math.min(100000, Math.max(1, Math.floor(Number(params.page) || 1)));
  const { applications, count } = await listApplications(search, status, page);
  const pageLink = (nextPage: number) =>
    `/businesses/applications?${new URLSearchParams({ q: search, status, page: String(nextPage) })}`;
  return (
    <>
      <PageHeader
        eyebrow="PROSPECTIVE BUSINESSES"
        title="Business applications"
        description="Review what prospective customers submitted, correct details with a preserved history, and create an approved business once."
        action={
          <ButtonLink href="/get-started" variant="secondary">
            Open customer form ↗
          </ButtonLink>
        }
      />
      <Panel
        title={`Applications (${count})`}
        description="Submitting the public form never creates a business automatically."
        padded={false}
      >
        <ApplicationFilters search={search} status={status} />
        <ApplicationList applications={applications} />
        <Pagination total={count} page={page} pageSize={APPLICATION_PAGE_SIZE} href={pageLink} />
      </Panel>
    </>
  );
}
