import { notFound } from 'next/navigation';
import { getBusinessDetails } from '@/modules/tenants/queries';
import { onboardingChecklist } from '@/modules/tenants/onboarding-checklist';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { ButtonLink } from '@/components/ui/button';
import { Checklist } from '@/components/ui/checklist';
import { ActivityList } from '@/components/businesses/activity-list';
import { BusinessSummary } from '@/components/businesses/business-summary';
export const metadata = { title: 'Business details' };
export default async function BusinessDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const details = await getBusinessDetails(id);
  if (!details) notFound();
  const { business, invitation, onboarding, activity } = details;
  return (
    <>
      <PageHeader
        eyebrow="BUSINESS WORKSPACE"
        title={business.name}
        description={`${business.slug} · ${business.status.toLowerCase()} · ${business.plans?.name ?? 'No plan'}`}
        action={
          <ButtonLink variant="secondary" href="/businesses">
            ← All businesses
          </ButtonLink>
        }
      />
      <div className="setup-grid">
        <div className="section-stack">
          <Panel title="Onboarding checklist">
            <Checklist items={onboardingChecklist(onboarding)} />
          </Panel>
          <Panel title="Recent activity">
            <ActivityList events={activity} />
          </Panel>
        </div>
        <BusinessSummary business={business} invitation={invitation} />
      </div>
    </>
  );
}
