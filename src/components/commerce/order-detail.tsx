'use client';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { FormActions, FormError } from '@/components/ui/form-layout';
import { TextAreaField } from '@/components/ui/form-fields';
import {
  performOrderAction,
  reconcilePaystackOrder,
  updateOrderNote,
} from '@/modules/commerce/actions';
import { formatMoney } from '@/modules/commerce/money';
import type { OrderDetail as Order, OrderItem, PaymentAttempt } from '@/modules/commerce/types';
import { OrderStatus } from './order-list';
import styles from './order-admin.module.css';

function nextFulfillmentAction(status: Order['fulfillment_status']) {
  if (status === 'NEW') return { value: 'PROCESS', label: 'Start preparing order' };
  if (status === 'PROCESSING') return { value: 'READY', label: 'Mark ready' };
  if (status === 'READY') return { value: 'SHIP', label: 'Mark shipped' };
  if (status === 'SHIPPED') return { value: 'DELIVER', label: 'Mark delivered' };
  return null;
}

export function OrderDetail({
  slug,
  order,
  items,
  payments,
}: {
  slug: string;
  order: Order;
  items: OrderItem[];
  payments: PaymentAttempt[];
}) {
  const next = nextFulfillmentAction(order.fulfillment_status);
  const initial = { error: '', message: '' };
  const [noteState, noteAction, notePending] = useActionState(
    updateOrderNote.bind(null, slug, order.id),
    initial,
  );
  const [paymentState, paymentAction, paymentPending] = useActionState(
    performOrderAction.bind(null, slug, order.id, 'CONFIRM_PAYMENT'),
    initial,
  );
  const [reconcileState, reconcileAction, reconcilePending] = useActionState(
    reconcilePaystackOrder.bind(null, slug, order.id),
    initial,
  );
  const [fulfillmentState, fulfillmentAction, fulfillmentPending] = useActionState(
    performOrderAction.bind(null, slug, order.id, next?.value ?? 'PROCESS'),
    initial,
  );
  const [cancelState, cancelAction, cancelPending] = useActionState(
    performOrderAction.bind(null, slug, order.id, 'CANCEL'),
    initial,
  );
  const address = order.shipping_address_jsonb;
  const payment = order.payment_instructions_snapshot;
  return (
    <div className={styles.detailGrid}>
      <div className={styles.detailMain}>
        <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <h2>Products ordered</h2>
            <span>
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </span>
          </div>
          <div className={styles.items}>
            {items.map((item) => (
              <div className={styles.item} key={item.id}>
                <div>
                  <strong>{item.product_name_snapshot}</strong>
                  {item.sku_snapshot && <small>SKU: {item.sku_snapshot}</small>}
                </div>
                <span>
                  {item.quantity} × {formatMoney(item.unit_price, order.currency)}
                </span>
                <strong>{formatMoney(item.line_total, order.currency)}</strong>
              </div>
            ))}
          </div>
          <dl className={styles.totals}>
            <div>
              <dt>Products</dt>
              <dd>{formatMoney(order.subtotal, order.currency)}</dd>
            </div>
            <div>
              <dt>Delivery</dt>
              <dd>{formatMoney(order.delivery_fee, order.currency)}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{formatMoney(order.total, order.currency)}</dd>
            </div>
          </dl>
        </section>
        <section className={styles.section}>
          <h2>Customer and delivery</h2>
          <div className={styles.infoGrid}>
            <div>
              <h3>Customer</h3>
              <p>{order.customer_name_snapshot}</p>
              {order.customer_email_snapshot && <p>{order.customer_email_snapshot}</p>}
              {order.customer_phone_snapshot && <p>{order.customer_phone_snapshot}</p>}
            </div>
            <div>
              <h3>{order.delivery_method_snapshot || 'Delivery'}</h3>
              {address.addressLine1 ? (
                <address>
                  {address.addressLine1}
                  {address.addressLine2 && (
                    <>
                      <br />
                      {address.addressLine2}
                    </>
                  )}
                  <br />
                  {address.city}, {address.state}
                  <br />
                  {address.country}
                </address>
              ) : (
                <p>No delivery address was required.</p>
              )}
            </div>
          </div>
          {order.customer_note && (
            <div className={styles.customerNote}>
              <strong>Customer note</strong>
              <p>{order.customer_note}</p>
            </div>
          )}
        </section>
        {payment.bankName && (
          <section className={styles.section}>
            <h2>Payment instructions for this order</h2>
            <div className={styles.infoGrid}>
              <div>
                <h3>Bank account shown to the customer</h3>
                <p>{payment.bankName}</p>
                <p>{payment.accountNumber}</p>
                <p>{payment.accountName}</p>
              </div>
              <div>
                <h3>Instructions</h3>
                <p>
                  {payment.instructions || 'The customer was asked to include the order reference.'}
                </p>
              </div>
            </div>
          </section>
        )}
        {order.payment_method === 'PAYSTACK' && (
          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <h2>Secure payment attempts</h2>
              <span>Paystack</span>
            </div>
            {payments.length ? (
              <div className={styles.paymentAttempts}>
                {payments.map((attempt) => (
                  <div key={attempt.id}>
                    <div>
                      <strong>
                        {attempt.order_application_status === 'DUPLICATE'
                          ? 'Duplicate payment received'
                          : attempt.order_application_status === 'LATE_CANCELLED'
                            ? 'Payment received after cancellation'
                            : attempt.resolution_status === 'REVIEW_REQUIRED'
                              ? 'Payment needs review'
                              : attempt.order_application_status === 'APPLIED'
                                ? 'Payment confirmed'
                                : 'Payment attempt'}
                      </strong>
                      <small>{attempt.provider_reference}</small>
                      {attempt.resolution_status !== 'NONE' && (
                        <small>
                          BusinessCare support must resolve this receipt before the case is closed.
                        </small>
                      )}
                    </div>
                    <div>
                      <OrderStatus
                        value={attempt.provider_status === 'SUCCESS' ? 'PAID' : attempt.status}
                      />
                      <small>
                        {new Intl.DateTimeFormat('en-NG', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }).format(new Date(attempt.paid_at ?? attempt.initiated_at))}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.emptyMessage}>No payment attempt has been recorded.</p>
            )}
          </section>
        )}
      </div>
      <aside className={styles.actionsPanel}>
        <div>
          <span>Payment</span>
          <OrderStatus value={order.payment_status} />
        </div>
        <div>
          <span>Fulfilment</span>
          <OrderStatus value={order.fulfillment_status} />
        </div>
        <form action={noteAction} className={styles.actionForm}>
          <TextAreaField
            name="internalNote"
            label="Private staff note"
            hint="Only people managing this store can see this note."
            defaultValue={order.internal_note}
            maxLength={2000}
          />
          <FormError message={noteState.error} />
          {noteState.message && (
            <p className={styles.saved} role="status">
              {noteState.message}
            </p>
          )}
          <Button type="submit" variant="secondary" disabled={notePending}>
            Save private note
          </Button>
        </form>
        {order.payment_method === 'BANK_TRANSFER' &&
          order.payment_status !== 'PAID' &&
          order.payment_status !== 'CANCELLED' && (
            <form action={paymentAction} className={styles.singleAction}>
              <FormError message={paymentState.error} />
              {paymentState.message && <p className={styles.saved}>{paymentState.message}</p>}
              <Button type="submit" disabled={paymentPending}>
                Confirm bank payment
              </Button>
            </form>
          )}
        {order.payment_method === 'PAYSTACK' &&
          order.payment_status !== 'PAID' &&
          order.payment_status !== 'CANCELLED' && (
            <form action={reconcileAction} className={styles.singleAction}>
              <FormError message={reconcileState.error} />
              {reconcileState.message && <p className={styles.saved}>{reconcileState.message}</p>}
              <Button type="submit" disabled={reconcilePending}>
                {reconcilePending ? 'Checking Paystack…' : 'Check payment with Paystack'}
              </Button>
            </form>
          )}
        {next && (
          <form action={fulfillmentAction} className={styles.singleAction}>
            <FormError message={fulfillmentState.error} />
            <Button type="submit" disabled={fulfillmentPending}>
              {next.label}
            </Button>
          </form>
        )}
        {!['DELIVERED', 'CANCELLED'].includes(order.fulfillment_status) && (
          <form action={cancelAction} className={styles.singleAction}>
            <FormError message={cancelState.error} />
            <Button
              className={styles.cancelButton}
              type="submit"
              variant="secondary"
              disabled={cancelPending}
            >
              Cancel fulfilment and return stock
            </Button>
          </form>
        )}
        <FormActions
          note={
            order.payment_method === 'PAYSTACK'
              ? 'Paystack payment cannot be confirmed manually. Use “Check payment with Paystack” if the automatic update is delayed. Cancelling fulfilment does not refund a confirmed payment. Every status change is recorded.'
              : 'Confirm payment only after checking the bank transfer. Cancelling fulfilment returns tracked stock but does not erase a verified payment. Every status change is recorded.'
          }
        >
          <span />
        </FormActions>
      </aside>
    </div>
  );
}
