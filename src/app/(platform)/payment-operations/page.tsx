import { PaymentOperations } from '@/components/payments/payment-operations';
import { PageHeader } from '@/components/ui/page-header';
import { getPaymentOperations } from '@/modules/payments/admin';

export const metadata = { title: 'Payment operations' };

export default async function PaymentOperationsPage() {
  const operations = await getPaymentOperations();
  return (
    <>
      <PageHeader
        eyebrow="PLATFORM OPERATIONS"
        title="Payments"
        description="Review provider receipts, resolve duplicate or late payments, and retry safely stored webhook events. BusinessCare changes payment state only after verified Paystack data."
      />
      <PaymentOperations
        payments={operations.payments}
        attention={operations.attention}
        webhooks={operations.webhooks}
      />
    </>
  );
}
