'use client';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { FormActions, FormError } from '@/components/ui/form-layout';
import { TextAreaField } from '@/components/ui/form-fields';
import { performOrderAction, updateOrderNote } from '@/modules/commerce/actions';
import { formatMoney } from '@/modules/commerce/money';
import type { OrderDetail as Order, OrderItem } from '@/modules/commerce/types';
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
}: {
  slug: string;
  order: Order;
  items: OrderItem[];
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
        {order.payment_status !== 'PAID' && order.payment_status !== 'CANCELLED' && (
          <form action={paymentAction} className={styles.singleAction}>
            <FormError message={paymentState.error} />
            <Button type="submit" disabled={paymentPending}>
              Confirm bank payment
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
        <FormActions note="Confirm payment only after checking the bank transfer. Cancelling fulfilment returns tracked stock but does not erase a verified payment; refunds will be handled separately when online payments are connected. Every status change is recorded in the activity log.">
          <span />
        </FormActions>
      </aside>
    </div>
  );
}
