import type { Business, OwnerInvitation } from '@/modules/tenants/types';
import { Panel } from '@/components/ui/panel';
import { InvitationControl, SuspensionControl } from './business-controls';
export function BusinessSummary({
  business,
  invitation,
}: {
  business: Business;
  invitation: OwnerInvitation | null;
}) {
  return (
    <Panel title="Business owner">
      <div className="business-summary">
        <section>
          <h3>{invitation?.owner_name ?? 'Owner not assigned'}</h3>
          <p>{invitation?.email}</p>
          <p>Invitation: {invitation?.status.toLowerCase() ?? 'Unavailable'}</p>
          {invitation?.status === 'PENDING' && business.status !== 'SUSPENDED' && (
            <InvitationControl id={invitation.id} />
          )}
        </section>
        <section>
          <h3>Storefront</h3>
          <p>
            Handle reserved: <strong>{business.slug}</strong>
          </p>
          <p>
            Template: {business.template_key}. Your storefront is a draft. Publishing and domain
            activation arrive in later stages.
          </p>
        </section>
        <section>
          <h3>Business status</h3>
          <p>Suspension blocks owner access and preserves all business records.</p>
          <SuspensionControl id={business.id} suspended={business.status === 'SUSPENDED'} />
        </section>
      </div>
    </Panel>
  );
}
