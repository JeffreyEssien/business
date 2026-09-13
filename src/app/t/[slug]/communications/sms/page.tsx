import { WorkspaceNavigation } from '@/components/catalog/workspace-navigation';
import { SmsLogList } from '@/components/sms/sms-log-list';
import { SmsSenderRequestForm, SmsSettingsForm } from '@/components/sms/sms-settings-form';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { getTenantSmsWorkspace } from '@/modules/sms/queries';

export const metadata = { title: 'Customer text messages' };

export default async function CustomerSmsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getTenantSmsWorkspace(slug);
  return (
    <main className="tenant-home">
      <WorkspaceNavigation name={data.tenant.name} slug={slug} />
      <PageHeader
        eyebrow="CUSTOMER COMMUNICATION"
        title="Customer text messages"
        description="Keep customers informed with short order updates that show your approved business name."
      />
      <Panel
        title="1. Choose the business name customers will see"
        description="Mobile networks must approve this short sender name before your store can use it."
      >
        <SmsSenderRequestForm
          slug={slug}
          settings={data.settings}
          businessName={data.businessName}
          entitled={data.entitled}
        />
      </Panel>
      <Panel
        title="2. Choose automatic order updates"
        description="BusinessCare creates a text message only after the matching order event happens."
      >
        <SmsSettingsForm
          slug={slug}
          settings={data.settings}
          entitled={data.entitled}
          deliveryReady={data.delivery.configured && data.delivery.mode !== 'disabled'}
        />
      </Panel>
      <Panel
        title="3. Recent text-message activity"
        description="Phone numbers are masked here. Message parts help you understand usage."
      >
        <SmsLogList logs={data.logs} />
      </Panel>
    </main>
  );
}
