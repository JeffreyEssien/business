import { EmailLogList } from '@/components/email/email-log-list';
import { EmailPreview } from '@/components/email/email-preview';
import { EmailSettingsForm } from '@/components/email/email-settings-form';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { getTenantEmailWorkspace } from '@/modules/email/queries';

export const metadata = { title: 'Customer emails' };

export default async function CustomerEmailsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getTenantEmailWorkspace(slug);
  return (
    <main className="tenant-home">
      <PageHeader
        eyebrow="CUSTOMER COMMUNICATION"
        title="Customer emails"
        description="Choose the helpful order updates customers receive. Every message uses your store identity and trusted order information."
      />
      <Panel
        title="1. Choose automatic order updates"
        description="BusinessCare creates each message only after the matching order event happens."
      >
        <EmailSettingsForm
          slug={slug}
          settings={data.settings}
          defaultSenderName={data.delivery.fromName}
          deliveryReady={data.delivery.configured && data.delivery.mode !== 'disabled'}
        />
      </Panel>
      <Panel
        title="2. See what customers will recognize"
        description="Products and totals come from the customer’s saved order. Colours and store identity come from this business."
      >
        <EmailPreview businessName={data.business.business_name} primaryColor={data.primaryColor} />
      </Panel>
      <Panel
        title="3. Recent email activity"
        description="Recipient addresses are masked here. Delivery problems remain visible for platform support."
      >
        <EmailLogList logs={data.logs} />
      </Panel>
    </main>
  );
}
