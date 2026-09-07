import Link from 'next/link';
import { BusinessList } from '@/components/super-admin/business-list';
import { LaunchCard } from '@/components/super-admin/launch-card';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { ButtonLink } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import { getPlatformOverview } from '@/modules/tenants/queries';
export default async function OverviewPage() {
  const { businesses, count, pending } = await getPlatformOverview();
  return (
    <>
      <PageHeader
        eyebrow="YOUR BUSINESS, BIGGER PICTURE"
        title="A home for every business."
        description="Your platform is ready. Bring your first brand on board."
        action={<ButtonLink href="/businesses/new">Create business ＋</ButtonLink>}
      />
      <section className="stats" aria-label="Platform metrics">
        <StatCard
          label="Total businesses"
          value={count}
          note="Live platform records"
          icon="▦"
          tone="lavender"
        />
        <StatCard
          label="Awaiting onboarding"
          value={pending}
          note="Businesses being set up"
          icon="↗"
          tone="mint"
        />
        <StatCard
          label="Platform MRR"
          value="—"
          note="Subscription billing not connected"
          icon="▤"
          tone="peach"
        />
        <StatCard
          label="Merchant sales · GMV"
          value="—"
          note="Commerce not connected"
          icon="▧"
          tone="blue"
        />
      </section>
      <div className="overview-grid">
        <Panel
          title={`Your businesses (${count})`}
          description="Different brands. One place to manage them."
          action={
            <Link className="text-link" href="/businesses">
              View all ↗
            </Link>
          }
          padded={false}
        >
          <BusinessList businesses={businesses} />
        </Panel>
        <LaunchCard />
      </div>
    </>
  );
}
