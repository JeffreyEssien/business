import { requirePlatformAdmin } from '@/modules/auth/authorization';
import { buildStages } from '@/modules/tenants/build-roadmap';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { Checklist } from '@/components/ui/checklist';
export const metadata = { title: 'Launch checklist' };
export default async function SetupPage() {
  await requirePlatformAdmin();
  const items = buildStages.map(([label, status, description]) => ({
    label,
    complete: status.startsWith('Ready'),
    description: `${status} · ${description}`,
  }));
  return (
    <>
      <PageHeader
        eyebrow="ONE STAGE AT A TIME"
        title="The road to your first store."
        description="A clear sequence from today’s foundation to a working commerce platform."
      />
      <div className="setup-grid">
        <Panel title="Build roadmap">
          <Checklist items={items} />
        </Panel>
        <Panel title="Ready for your first business.">
          <div className="business-summary">
            <section>
              <h3>Now: business onboarding</h3>
              <p>
                Business name, store handle, owner name and email, initial template, and plan.
                Generate and share the owner invitation after creation.
              </p>
            </section>
            <section>
              <h3>Next: catalog and content</h3>
              <p>Product names, prices, images, categories, logo, and preferred branding.</p>
            </section>
            <section>
              <h3>When integrations begin</h3>
              <p>
                Paystack test account, email and SMS provider accounts, then your domain and hosting
                access.
              </p>
            </section>
          </div>
        </Panel>
      </div>
    </>
  );
}
