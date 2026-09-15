import { renderTransactionalEmail } from '@/modules/email/templates';
import type { EmailNotificationContext } from '@/modules/email/types';
import styles from './email.module.css';

export function EmailPreview({
  businessName,
  primaryColor,
}: {
  businessName: string;
  primaryColor: string;
}) {
  const sample: EmailNotificationContext = {
    id: '00000000-0000-4000-8000-000000000001',
    tenantId: '00000000-0000-4000-8000-000000000002',
    orderId: '00000000-0000-4000-8000-000000000003',
    eventType: 'ORDER_RECEIVED',
    recipientEmail: 'customer@example.invalid',
    recipientName: 'Customer',
    subject: 'We received order BC-EXAMPLE-1001',
    idempotencyKey: 'preview/order-received',
    status: 'SENDING',
    attemptCount: 1,
    templateData: {
      businessName,
      businessEmail: '',
      storeSlug: 'example-store',
      logoUrl: '',
      primaryColor,
      backgroundColor: '#ffffff',
      senderName: 'Jeff from BusinessCare',
      replyTo: '',
    },
    order: {
      reference: 'BC-EXAMPLE-1001',
      subtotal: 12500,
      deliveryFee: 1500,
      total: 14000,
      currency: 'NGN',
      deliveryMethod: 'Lagos delivery',
      deliveryInstructions: '',
      paymentMethod: 'BANK_TRANSFER',
      createdAt: new Date(0).toISOString(),
    },
    items: [{ name: 'Example product', quantity: 1, unitPrice: 12500, lineTotal: 12500 }],
  };
  const rendered = renderTransactionalEmail(sample);
  return (
    <div className={styles.preview}>
      <iframe
        className={styles.previewFrame}
        title="Example customer order email"
        srcDoc={rendered.html}
        sandbox=""
      />
    </div>
  );
}
