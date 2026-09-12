'use client';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/modules/commerce/money';
import {
  retryPaymentReconciliation,
  retryWebhookProcessing,
  type PaymentOperationState,
} from '@/modules/payments/actions';
import type { PaymentOperation, WebhookOperation } from '@/modules/payments/types';
import styles from './payment-operations.module.css';

const initial: PaymentOperationState = { error: '', message: '' };

function ReconcilePayment({ payment }: { payment: PaymentOperation }) {
  const [state, action, pending] = useActionState(
    retryPaymentReconciliation.bind(null, payment.id),
    initial,
  );
  if (payment.providerStatus === 'SUCCESS') return null;
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

function ReplayWebhook({ event }: { event: WebhookOperation }) {
  const [state, action, pending] = useActionState(
    retryWebhookProcessing.bind(null, event.id),
    initial,
  );
  if (!['FAILED', 'RECEIVED'].includes(event.processingStatus)) return null;
  return (
    <form action={action} className={styles.reconcile}>
      {state.error && <small className={styles.error}>{state.error}</small>}
      {state.message && <small className={styles.success}>{state.message}</small>}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? 'Retrying stored event…' : 'Retry stored event'}
      </Button>
    </form>
  );
}

export function PaymentOperations({
  payments,
  attention,
  webhooks,
}: {
  payments: PaymentOperation[];
  attention: PaymentOperation[];
  webhooks: WebhookOperation[];
}) {
  return (
    <div className={styles.stack}>
      <section className={`${styles.panel} ${styles.attentionPanel}`}>
        <header>
          <h2>Money requiring attention</h2>
          <p>
            These are provider-confirmed receipts that were not applied normally. Resolve them in
            Paystack and record the outcome before closing the case.
          </p>
        </header>
        {attention.length ? (
          <div className={styles.list}>
            {attention.map((payment) => (
              <article key={payment.id}>
                <div>
                  <strong>{payment.tenantName}</strong>
                  <span>{payment.orderReference}</span>
                  <small>{payment.providerReference}</small>
                </div>
                <div className={styles.amount}>
                  <strong>{formatMoney(payment.amount, payment.currency)}</strong>
                  <span data-status={payment.resolutionStatus}>
                    {payment.resolutionStatus.replaceAll('_', ' ')}
                  </span>
                  <small>{payment.orderApplicationStatus.replaceAll('_', ' ')}</small>
                </div>
                <div className={styles.guidance}>
                  <strong>Do not fulfil twice</strong>
                  <small>
                    Verify the receipt and refund or resolve it from the provider record.
                  </small>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className={styles.empty}>No duplicate, late, or mismatched receipts need attention.</p>
        )}
      </section>
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
                  <small>
                    Provider: {payment.providerStatus.toLowerCase().replaceAll('_', ' ')} · Applied:{' '}
                    {payment.orderApplicationStatus.toLowerCase().replaceAll('_', ' ')}
                  </small>
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
                  <small>
                    {event.attempts} processing attempt{event.attempts === 1 ? '' : 's'}
                  </small>
                </div>
                <ReplayWebhook event={event} />
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
