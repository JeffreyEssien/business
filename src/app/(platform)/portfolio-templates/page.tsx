import { TemplateAdministration } from '@/components/portfolio/template-administration';
import { ButtonLink } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { getTemplateAdministration } from '@/modules/portfolio/queries';
import { portfolioTemplateLibrary } from '@/modules/portfolio/template-library';

export const metadata = { title: 'Portfolio templates' };

export default async function PortfolioTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;
  // getTemplateAdministration requires a platform admin before reading anything.
  const rows = await getTemplateAdministration();
  const offered = rows.filter((row) => row.active).length;
  return (
    <>
      <PageHeader
        eyebrow="PORTFOLIOS"
        title="Portfolio templates"
        description="Choose which templates new portfolio owners can pick. Hiding one never changes portfolios that already use it."
        action={
          <ButtonLink href="/templates" variant="secondary">
            Open public gallery ↗
          </ButtonLink>
        }
      />
      <Panel title={`Templates (${offered} of ${portfolioTemplateLibrary.length} offered)`}>
        <TemplateAdministration templates={portfolioTemplateLibrary} rows={rows} notice={notice} />
      </Panel>
    </>
  );
}
