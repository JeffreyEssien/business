'use client';
import Link from 'next/link';
import { useActionState, useEffect } from 'react';
import { retryPaystackPayment } from '@/modules/commerce/actions';
import { formatMoney } from '@/modules/commerce/money';
import type { PublicPaystackOrder } from '@/modules/commerce/types';
import styles from './commerce.module.css';

export function PaystackPaymentStatus({
  slug,
  accessToken,
  order,
}: {
  slug: string;
  accessToken: string;
  order: PublicPaystackOrder;
}) {
  const [state, action, pending] = useActionState(
    retryPaystackPayment.bind(null, slug, order.reference, accessToken),
    { error: '', authorizationUrl: '' },
  );
  useEffect(() => {
    if (state.authorizationUrl.startsWith('https://checkout.paystack.com/'))
      window.location.assign(state.authorizationUrl);
  }, [state.authorizationUrl]);

  const paid = order.paymentStatus === 'PAID';
  const cancelled = order.paymentStatus === 'CANCELLED';
  return (
    <section className={styles.confirmation} aria-labelledby="payment-result-heading">
      <p className={styles.step}>{paid ? 'Payment confirmed' : 'Payment status'}</p>
      <h1 id="payment-result-heading">
        {paid
          ? 'Your payment was successful.'
          : cancelled
            ? 'This order was cancelled.'
            : 'Your payment is not confirmed yet.'}
      </h1>
      <p>
        {paid
          ? order.successMessage
          : cancelled
            ? 'No further payment can be made for this order. Contact the store if you need help.'
            : 'If you completed payment, confirmation may take a moment. You can refresh this page safely.'}
      </p>
      <dl className={styles.summaryList}>
        <div>
          <dt>Order reference</dt>
          <dd>{order.reference}</dd>
        </div>
        <div>
          <dt>Order total</dt>
          <dd>{formatMoney(order.total, order.currency)}</dd>
        </div>
        <div>
          <dt>Payment</dt>
          <dd>{paid ? 'Confirmed' : cancelled ? 'Cancelled' : 'Awaiting confirmation'}</dd>
        </div>
      </dl>
      {state.error && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}
      <div className={styles.paymentActions}>
        {!paid && !cancelled && (
          <>
            <button
              type="button"
              className={styles.secondaryLink}
              onClick={() => location.reload()}
            >
              Refresh payment status
            </button>
            <form action={action}>
              <button type="submit" disabled={pending}>
                {pending ? 'Opening secure payment…' : 'Try payment again'}
              </button>
            </form>
          </>
        )}
        <Link className={styles.secondaryLink} href={`/store/${slug}`}>
          Return to {order.storeName}
        </Link>
      </div>
    </section>
  );
}
