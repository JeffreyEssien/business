import { getTenantWorkspace } from '@/modules/tenants/workspace-query';
import { onboardingChecklist } from '@/modules/tenants/onboarding-checklist';
import { AuthLayout } from '@/components/auth/auth-layout';
import { SignOutForm } from '@/components/auth/sign-out-form';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { Checklist } from '@/components/ui/checklist';
import { ButtonLink } from '@/components/ui/button';
import { siteKindOf } from '@/modules/portfolio/types';
import { getPortfolioBuilder } from '@/modules/portfolio/builder-queries';
export const metadata = { title: 'Business workspace' };
export default async function TenantWorkspacePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { tenant, setup } = await getTenantWorkspace(slug);
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
  const siteKind = siteKindOf(tenant.site_kind);
  if (siteKind === 'PORTFOLIO') {
    // Counts what the publish lock would refuse: visible parts and entries with examples.
    const { parts, entries } = await getPortfolioBuilder(slug);
    const examplesLeft =
      parts.filter((part) => part.enabled && part.exampleFields.length).length +
      entries.filter((entry) => !entry.hidden && entry.exampleFields.length).length;
    return (
      <main className="tenant-home">
        <PageHeader
          eyebrow="YOUR PORTFOLIO WORKSPACE"
          title="Welcome to your next chapter."
          description={`Your account is connected to ${tenant.name}. Let’s get your portfolio ready.`}
        />
        <Panel title="Your launch checklist">
          <Checklist items={onboardingChecklist(setup, siteKind, examplesLeft)} />
        </Panel>
        <p>
          <ButtonLink href={`/t/${slug}/design`}>Edit your page</ButtonLink>{' '}
          <ButtonLink href={`/t/${slug}/portfolio`} variant="secondary">
            Work &amp; experience
          </ButtonLink>{' '}
          <ButtonLink href={`/t/${slug}/marketing/search`} variant="secondary">
            Search appearance
          </ButtonLink>
        </p>
      </main>
    );
  }
  return (
    <main className="tenant-home">
      <PageHeader
        eyebrow="YOUR BUSINESS WORKSPACE"
        title="Welcome to your next chapter."
        description={`Your account is connected to ${tenant.name}. Let’s get your store ready.`}
      />
      <Panel title="Your launch checklist">
        <Checklist items={onboardingChecklist(setup)} />
      </Panel>
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
