'use client';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/modules/commerce/money';
import { retryPaymentReconciliation, type PaymentOperationState } from '@/modules/payments/actions';
import type { PaymentOperation, WebhookOperation } from '@/modules/payments/types';
import styles from './payment-operations.module.css';

const initial: PaymentOperationState = { error: '', message: '' };

function ReconcilePayment({ payment }: { payment: PaymentOperation }) {
  const [state, action, pending] = useActionState(
    retryPaymentReconciliation.bind(null, payment.id),
    initial,
  );
  if (payment.status === 'SUCCESS' || payment.status === 'CANCELLED') return null;
  return (
    <form action={action} className={styles.reconcile}>
      {state.error && <small className={styles.error}>{state.error}</small>}
      {state.message && <small className={styles.success}>{state.message}</small>}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? 'Checking Paystack…' : 'Check with Paystack again'}
      </Button>
    </form>
  );
}

export function PaymentOperations({
  payments,
  webhooks,
}: {
  payments: PaymentOperation[];
  webhooks: WebhookOperation[];
}) {
  return (
    <div className={styles.stack}>
      <section className={styles.panel}>
        <header>
          <h2>Recent customer payments</h2>
          <p>Up to 50 recent attempts across all businesses. Customer details are not shown.</p>
        </header>
        {payments.length ? (
          <div className={styles.list}>
            {payments.map((payment) => (
              <article key={payment.id}>
                <div>
                  <strong>{payment.tenantName}</strong>
                  <span>{payment.orderReference}</span>
                  <small>{payment.providerReference}</small>
                </div>
                <div className={styles.amount}>
                  <strong>{formatMoney(payment.amount, payment.currency)}</strong>
                  <span data-status={payment.status}>{payment.status.replaceAll('_', ' ')}</span>
                  <small>{new Date(payment.initiatedAt).toLocaleString('en-NG')}</small>
                </div>
                <ReconcilePayment payment={payment} />
              </article>
            ))}
          </div>
        ) : (
          <p className={styles.empty}>No Paystack payment attempts have been recorded yet.</p>
        )}
      </section>
      <section className={styles.panel}>
        <header>
          <h2>Recent webhook processing</h2>
          <p>Use rejected events to identify provider notifications that need investigation.</p>
        </header>
        {webhooks.length ? (
          <div className={styles.eventList}>
            {webhooks.map((event) => (
              <article key={event.id}>
                <div>
                  <strong>{event.eventType}</strong>
                  <small>{event.providerReference || 'No payment reference'}</small>
                </div>
                <div>
                  <span data-status={event.processingStatus}>{event.processingStatus}</span>
                  <small>
                    {event.errorCode ?? new Date(event.receivedAt).toLocaleString('en-NG')}
                  </small>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className={styles.empty}>No Paystack webhook events have been received yet.</p>
        )}
      </section>
    </div>
  );
}
