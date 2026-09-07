import { getTenantWorkspace } from '@/modules/tenants/workspace-query';
import { onboardingChecklist } from '@/modules/tenants/onboarding-checklist';
import { AuthLayout } from '@/components/auth/auth-layout';
import { SignOutForm } from '@/components/auth/sign-out-form';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { Checklist } from '@/components/ui/checklist';
import { ButtonLink } from '@/components/ui/button';
import { WorkspaceNavigation } from '@/components/catalog/workspace-navigation';
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
  return (
    <main className="tenant-home">
      <WorkspaceNavigation name={tenant.name} slug={slug} />
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
        <ButtonLink href="/workspace" variant="secondary">
          ← Your businesses
        </ButtonLink>
      </p>
    </main>
  );
}
