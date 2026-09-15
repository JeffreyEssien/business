import { SmsDeliveryOperations, SmsSenderRequests } from '@/components/sms/sms-operations';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { getPlatformSmsOperations } from '@/modules/sms/queries';

export const metadata = { title: 'SMS operations' };

export default async function SmsOperationsPage() {
  const data = await getPlatformSmsOperations();
  return (
    <>
      <PageHeader
        eyebrow="PLATFORM OPERATIONS"
        title="Customer text-message delivery"
        description="Review business sender names, monitor tenant-branded order updates, and resolve delivery problems without exposing customer phone numbers."
      />
      <Panel
        title="1. Business sender-name requests"
        description="Confirm that each requested name and message purpose belongs to the business before sending it for network approval."
      >
        <SmsSenderRequests requests={data.requests} />
      </Panel>
      <Panel
        title="2. Transactional text-message activity"
        description="Only safe failures can be retried. Unknown delivery outcomes require investigation to prevent duplicate messages."
      >
        <SmsDeliveryOperations
          logs={data.logs}
          mode={data.delivery.mode}
          configured={data.delivery.configured}
        />
      </Panel>
    </>
  );
}
