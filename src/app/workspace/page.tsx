import { listMyWorkspaces } from '@/modules/tenants/membership-query';
import { AuthLayout } from '@/components/auth/auth-layout';
import { SignOutForm } from '@/components/auth/sign-out-form';
import { ButtonLink } from '@/components/ui/button';
export default async function WorkspacePage() {
  const memberships = await listMyWorkspaces();
  return (
    <AuthLayout
      title="Your businesses."
      description="Select your business workspace."
      footer={<SignOutForm />}
    >
      <div className="section-stack">
        {memberships.map(
          (membership) =>
            membership.tenants && (
              <ButtonLink
                key={membership.tenant_id}
                variant="secondary"
                href={`/t/${membership.tenants.slug}`}
              >
                {membership.tenants.name} →
              </ButtonLink>
            ),
        )}
      </div>
      {!memberships.length && (
        <p>No active business memberships yet. Open your invitation link to accept access.</p>
      )}
    </AuthLayout>
  );
}
