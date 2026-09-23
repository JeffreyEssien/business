import { FeatureManagement } from '@/components/entitlements/feature-management';
import { PageHeader } from '@/components/ui/page-header';
import { getFeatureManagement } from '@/modules/entitlements/queries';

export const metadata = { title: 'Plans and features' };

export default async function FeaturesPage({
  searchParams,
}: {
  searchParams: Promise<{ business?: string; notice?: string }>;
}) {
  const filters = await searchParams;
  const data = await getFeatureManagement(filters.business);
  return (
    <main>
      <PageHeader
        eyebrow="PLANS & ACCESS"
        title="Plans and features"
        description="Control what each plan includes, pause risky integrations, and make documented exceptions for individual businesses."
      />
      <FeatureManagement
        data={data}
        now={Date.now()}
        notice={filters.notice === 'override-removed' ? 'Business returned to its plan value.' : ''}
      />
    </main>
  );
}
