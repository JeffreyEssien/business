import { EmailOperations } from '@/components/email/email-operations';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { getPlatformEmailOperations } from '@/modules/email/queries';

export const metadata = { title: 'Email operations' };

export default async function CommunicationsPage() {
  const data = await getPlatformEmailOperations();
  return (
    <>
      <PageHeader
        eyebrow="PLATFORM OPERATIONS"
        title="Customer email delivery"
        description="Monitor tenant-branded order messages, identify delivery failures, and process the durable queue without exposing customer email addresses."
      />
      <Panel title="Transactional email activity">
        <EmailOperations
          logs={data.logs}
          mode={data.delivery.mode}
          configured={data.delivery.configured}
        />
      </Panel>
    </>
  );
}
