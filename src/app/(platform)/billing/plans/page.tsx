import { PlanManagement } from '@/components/billing/plan-management';
import { PageHeader } from '@/components/ui/page-header';
import { getPlanManagement } from '@/modules/billing/queries';

export const metadata = { title: 'Plans and pricing' };

// The (platform) layout already requires a Super Admin; getPlanManagement
// re-resolves that authority at the data boundary as well.
export default async function PlanPricingPage() {
  const data = await getPlanManagement();
  return (
    <main>
      <PageHeader
        eyebrow="PLANS & ACCESS"
        title="Plans and pricing"
        description="Set what each plan costs, how often it is charged, and whether new businesses can see it. What each plan includes is managed under Features & limits."
      />
      <PlanManagement data={data} />
    </main>
  );
}
