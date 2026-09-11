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
        description="Review Paystack attempts and safely ask the provider to verify an unresolved payment again. BusinessCare never marks an online payment paid from this screen alone."
      />
      <PaymentOperations payments={operations.payments} webhooks={operations.webhooks} />
    </>
  );
}
