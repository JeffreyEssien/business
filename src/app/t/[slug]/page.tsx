import { getTenantWorkspace } from '@/modules/tenants/workspace-query';
import { onboardingChecklist } from '@/modules/tenants/onboarding-checklist';
import { getTenantDashboard } from '@/modules/commerce/queries';
import { AuthLayout } from '@/components/auth/auth-layout';
import { SignOutForm } from '@/components/auth/sign-out-form';
import { OrderList } from '@/components/commerce/order-list';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { Checklist } from '@/components/ui/checklist';
import { ButtonLink } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
export const metadata = { title: 'Business workspace' };
export default async function TenantWorkspacePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const workspace = await getTenantWorkspace(slug);
  const { tenant, setup } = workspace;
  if (!['TRIAL', 'ACTIVE', 'PROVISIONING'].includes(tenant.status)) {
    return (
      <AuthLayout
        title="Workspace temporarily unavailable."
        description="Contact the platform administrator. Your business records are preserved."
      >
        <SignOutForm />
      </AuthLayout>
    );
  }
  const dashboard = await getTenantDashboard(workspace);
  const checklist = onboardingChecklist(setup);
  const launched = checklist.every((item) => item.complete);
  return (
    <main className="tenant-home">
      <PageHeader
        eyebrow="YOUR BUSINESS WORKSPACE"
        title={launched ? `Welcome back to ${tenant.name}.` : 'Welcome to your next chapter.'}
        description={
          launched
            ? 'Here is what needs your attention today.'
            : `Your account is connected to ${tenant.name}. Let’s get your store ready.`
        }
      />
      <section className="stats" aria-label="Business summary">
        <StatCard
          label="Payments to confirm"
          value={dashboard.awaitingVerification}
          note="Bank transfers customers say they have sent"
          icon="◷"
          tone="peach"
        />
        <StatCard
          label="Paid orders to send"
          value={dashboard.toFulfil}
          note="Paid and not yet shipped or collected"
          icon="↗"
          tone="mint"
        />
        <StatCard
          label="Orders"
          value={dashboard.recentOrderCount}
          note={`In the last ${dashboard.windowDays} days`}
          icon="▤"
          tone="lavender"
        />
        <StatCard
          label="Customers"
          value={dashboard.customers}
          note="Everyone who has ordered"
          icon="◎"
          tone="blue"
        />
      </section>
      <Panel
        title="Recent orders"
        padded={false}
        action={
          <ButtonLink href={`/t/${slug}/orders`} variant="secondary">
            View all orders
          </ButtonLink>
        }
      >
        <OrderList slug={slug} orders={dashboard.recentOrders} />
      </Panel>
      {!launched && (
        <Panel title="Your launch checklist">
          <Checklist items={checklist} />
        </Panel>
      )}
      <p>
        <ButtonLink href={`/t/${slug}/catalog`}>Manage catalog</ButtonLink>{' '}
        <ButtonLink href={`/t/${slug}/design`} variant="secondary">
          Design storefront
        </ButtonLink>{' '}
        <ButtonLink href={`/t/${slug}/orders/settings`} variant="secondary">
          Choose payment methods
        </ButtonLink>
      </p>
    </main>
  );
}
