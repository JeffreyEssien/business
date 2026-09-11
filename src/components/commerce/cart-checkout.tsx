'use client';
import Link from 'next/link';
import { startTransition, useActionState, useEffect, useMemo, useState } from 'react';
import {
  createOrder,
  quoteCart,
  retryPaystackPayment,
  submitTransferNotice,
} from '@/modules/commerce/actions';
import { readCart, saveCart } from '@/modules/commerce/cart';
import { formatMoney } from '@/modules/commerce/money';
import type { CheckoutQuote, CreatedOrder, StoredCartLine } from '@/modules/commerce/types';
import styles from './commerce.module.css';

function TransferNotice({ slug, order }: { slug: string; order: CreatedOrder }) {
  const [status, setStatus] = useState({ error: '', message: '' });
  const [pending, setPending] = useState(false);
  return (
    <div className={styles.transferNotice}>
      <p>After making the transfer, tell the store so they can verify it.</p>
      {status.error && (
        <p className={styles.error} role="alert">
          {status.error}
        </p>
      )}
      {status.message ? (
        <p className={styles.success} role="status">
          {status.message}
        </p>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setPending(true);
            startTransition(() => {
              void submitTransferNotice(slug, order.reference, order.accessToken).then((result) => {
                setStatus(result);
                setPending(false);
              });
            });
          }}
        >
          {pending ? 'Sending payment notice…' : 'I have made the transfer'}
        </button>
      )}
    </div>
  );
}

function OrderConfirmation({ slug, order }: { slug: string; order: CreatedOrder }) {
  const [paymentState, paymentAction, paymentPending] = useActionState(
    retryPaystackPayment.bind(null, slug, order.reference, order.accessToken),
    { error: '', authorizationUrl: '' },
  );
  useEffect(() => {
    const destination = order.paymentAuthorizationUrl || paymentState.authorizationUrl;
    if (destination?.startsWith('https://checkout.paystack.com/'))
      window.location.assign(destination);
  }, [order.paymentAuthorizationUrl, paymentState.authorizationUrl]);

  return (
    <section className={styles.confirmation} aria-labelledby="order-confirmation-heading">
      <p className={styles.step}>Order received</p>
      <h1 id="order-confirmation-heading">Thank you for your order.</h1>
      <p>{order.successMessage}</p>
      <dl className={styles.summaryList}>
        <div>
          <dt>Order reference</dt>
          <dd>{order.reference}</dd>
        </div>
        <div>
          <dt>Order total</dt>
          <dd>{formatMoney(order.total, order.currency)}</dd>
        </div>
      </dl>
      {order.paymentMethod === 'BANK_TRANSFER' && order.bankAccount ? (
        <>
          <div className={styles.bankDetails}>
            <h2>Pay by bank transfer</h2>
            <p>
              Use the order reference <strong>{order.reference}</strong> when making your transfer.
            </p>
            <dl>
              <div>
                <dt>Bank</dt>
                <dd>{order.bankAccount.bankName}</dd>
              </div>
              <div>
                <dt>Account number</dt>
                <dd>{order.bankAccount.accountNumber}</dd>
              </div>
              <div>
                <dt>Account name</dt>
                <dd>{order.bankAccount.accountName}</dd>
              </div>
            </dl>
            {order.bankAccount.instructions && <p>{order.bankAccount.instructions}</p>}
          </div>
          <TransferNotice slug={slug} order={order} />
        </>
      ) : (
        <div className={styles.bankDetails}>
          <h2>
            {order.paymentAuthorizationUrl ? 'Opening secure payment…' : 'Complete your payment'}
          </h2>
          <p>
            Your order is saved. Paystack will securely collect your payment and return you here
            with the result.
          </p>
          {(order.paymentError || paymentState.error) && (
            <p className={styles.error} role="alert">
              {paymentState.error || order.paymentError}
            </p>
          )}
          {!order.paymentAuthorizationUrl && (
            <form action={paymentAction}>
              <button type="submit" disabled={paymentPending}>
                {paymentPending ? 'Opening secure payment…' : 'Try secure payment again'}
              </button>
            </form>
          )}
        </div>
      )}
      <Link className={styles.secondaryLink} href={`/store/${slug}`}>
        Continue shopping
      </Link>
    </section>
  );
}

export function CartCheckout({ slug, step }: { slug: string; step: 'cart' | 'checkout' }) {
  const [lines, setLines] = useState<StoredCartLine[]>([]);
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [quoteError, setQuoteError] = useState('');
  const [loading, setLoading] = useState(true);
  const [shippingRate, setShippingRate] = useState('');
  const [paymentChoice, setPaymentChoice] = useState<'BANK_TRANSFER' | 'PAYSTACK'>('BANK_TRANSFER');
  const [state, formAction, submitting] = useActionState(createOrder.bind(null, slug), {
    error: '',
    order: null,
  });

  useEffect(() => setLines(readCart(slug)), [slug]);
  useEffect(() => {
    if (!lines.length) {
      setQuote(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    startTransition(() => {
      void quoteCart(
        slug,
        lines.map(({ productId, quantity }) => ({ productId, quantity })),
      ).then((result) => {
        setQuote(result.quote);
        setQuoteError(result.error);
        setLoading(false);
      });
    });
  }, [lines, slug]);
  useEffect(() => {
    if (!state.order) return;
    saveCart(slug, []);
  }, [slug, state.order]);
  useEffect(() => {
    if (!quote) return;
    if (!quote.settings.bankTransferEnabled && quote.settings.paystackEnabled)
      setPaymentChoice('PAYSTACK');
    else if (!quote.settings.paystackEnabled) setPaymentChoice('BANK_TRANSFER');
  }, [quote]);

  const chosenRate = quote?.shippingRates.find((rate) => rate.id === shippingRate);
  const currency =
    quote?.items.find((item) => item.currency)?.currency ?? lines[0]?.currency ?? 'NGN';
  const subtotal = useMemo(
    () =>
      quote
        ? quote.items.reduce((total, item) => total + (item.unitPrice ?? 0) * item.quantity, 0)
        : lines.reduce((total, item) => total + item.unitPrice * item.quantity, 0),
    [lines, quote],
  );
  const unavailable = quote?.items.some((item) => !item.available || !item.name) ?? false;

  function changeQuantity(productId: string, quantity: number) {
    const next = lines
      .map((line) =>
        line.productId === productId
          ? { ...line, quantity: Math.max(0, Math.min(99, quantity)) }
          : line,
      )
      .filter((line) => line.quantity > 0);
    saveCart(slug, next);
    setLines(next);
  }

  if (state.order) return <OrderConfirmation slug={slug} order={state.order} />;
  if (!lines.length && !loading)
    return (
      <section className={styles.emptyCart}>
        <p className={styles.step}>Your cart</p>
        <h1>Your cart is empty.</h1>
        <p>Browse the store and add something you would like to order.</p>
        <Link className={styles.primaryLink} href={`/store/${slug}/products`}>
          Browse products
        </Link>
      </section>
    );

  return (
    <div className={styles.checkoutLayout}>
      <section>
        <p className={styles.step}>{step === 'cart' ? 'Step 1 of 2' : 'Step 2 of 2'}</p>
        <h1>{step === 'cart' ? 'Review your cart' : 'Delivery and contact details'}</h1>
        <p>
          {step === 'cart'
            ? 'Check quantities before continuing to checkout.'
            : 'Tell the store how to contact you and where the order should go.'}
        </p>
        {quoteError && (
          <p className={styles.error} role="alert">
            {quoteError}
          </p>
        )}
        {loading && (
          <p className={styles.loading} role="status">
            Checking current prices and availability…
          </p>
        )}
        {step === 'cart' ? (
          <div className={styles.cartLines}>
            {lines.map((line) => {
              const current = quote?.items.find((item) => item.productId === line.productId);
              return (
                <article className={styles.cartLine} key={line.productId}>
                  {line.mediaUrl ? (
                    <img src={line.mediaUrl} alt="" />
                  ) : (
                    <div className={styles.mediaPlaceholder} />
                  )}
                  <div>
                    <h2>{current?.name ?? line.name}</h2>
                    <p>
                      {current?.unitPrice != null
                        ? formatMoney(current.unitPrice, current.currency)
                        : loading
                          ? formatMoney(line.unitPrice, line.currency)
                          : 'No longer available'}
                    </p>
                    {current && !current.available && (
                      <p className={styles.error}>The requested quantity is not available.</p>
                    )}
                  </div>
                  <div className={styles.quantity} aria-label={`Quantity for ${line.name}`}>
                    <button
                      type="button"
                      onClick={() => changeQuantity(line.productId, line.quantity - 1)}
                      aria-label={`Remove one ${line.name}`}
                    >
                      −
                    </button>
                    <span>{line.quantity}</span>
                    <button
                      type="button"
                      disabled={Boolean(current && line.quantity >= current.maximumQuantity)}
                      onClick={() => changeQuantity(line.productId, line.quantity + 1)}
                      aria-label={`Add one more ${line.name}`}
                    >
                      +
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <form action={formAction} className={styles.checkoutForm}>
            <input
              type="hidden"
              name="cart"
              value={JSON.stringify(
                lines.map(({ productId, quantity }) => ({ productId, quantity })),
              )}
            />
            <fieldset>
              <legend>Contact details</legend>
              <label>
                Full name
                <input name="name" autoComplete="name" required maxLength={160} />
              </label>
              {(quote?.settings.collectEmail || paymentChoice === 'PAYSTACK') && (
                <label>
                  Email address
                  <input name="email" type="email" autoComplete="email" required maxLength={254} />
                  {paymentChoice === 'PAYSTACK' && !quote?.settings.collectEmail && (
                    <small>Paystack uses this email to identify your secure payment.</small>
                  )}
                </label>
              )}
              {quote?.settings.collectPhone && (
                <label>
                  Phone number
                  <input
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    required
                    minLength={7}
                    maxLength={40}
                  />
                </label>
              )}
            </fieldset>
            {quote?.shippingRates.length ? (
              <fieldset>
                <legend>How would you like to receive your order?</legend>
                <div className={styles.deliveryChoices}>
                  {quote.shippingRates.map((rate) => (
                    <label key={rate.id}>
                      <input
                        type="radio"
                        name="shippingRate"
                        value={rate.id}
                        required
                        checked={shippingRate === rate.id}
                        onChange={() => setShippingRate(rate.id)}
                      />
                      <span>
                        <strong>{rate.name}</strong>
                        <small>
                          {rate.zoneName} ·{' '}
                          {rate.amount ? formatMoney(rate.amount, currency) : 'Free'}
                        </small>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}
            {quote?.settings.collectDeliveryAddress && !chosenRate?.isPickup && (
              <fieldset>
                <legend>Delivery address</legend>
                <label>
                  Street address
                  <input
                    name="addressLine1"
                    autoComplete="address-line1"
                    required
                    maxLength={240}
                  />
                </label>
                <label>
                  Apartment, suite, or landmark (optional)
                  <input name="addressLine2" autoComplete="address-line2" maxLength={240} />
                </label>
                <div className={styles.formGrid}>
                  <label>
                    City
                    <input name="city" autoComplete="address-level2" required maxLength={100} />
                  </label>
                  <label>
                    State
                    <input name="state" autoComplete="address-level1" required maxLength={100} />
                  </label>
                </div>
                <div className={styles.formGrid}>
                  <label>
                    Postal code (optional)
                    <input name="postalCode" autoComplete="postal-code" maxLength={30} />
                  </label>
                  <label>
                    Country code
                    <input
                      name="country"
                      defaultValue="NG"
                      required
                      pattern="[A-Za-z]{2}"
                      maxLength={2}
                    />
                  </label>
                </div>
              </fieldset>
            )}
            {quote?.settings.orderNotesEnabled && (
              <label>
                Order note (optional)
                <textarea
                  name="note"
                  maxLength={1000}
                  placeholder="Add delivery directions or anything the store should know."
                />
              </label>
            )}
            <fieldset>
              <legend>How would you like to pay?</legend>
              <div className={styles.paymentChoices}>
                {quote?.settings.paystackEnabled && (
                  <label className={styles.paymentChoice}>
                    <input
                      type="radio"
                      name="paymentChoice"
                      value="PAYSTACK"
                      checked={paymentChoice === 'PAYSTACK'}
                      onChange={() => setPaymentChoice('PAYSTACK')}
                    />
                    <span>
                      <strong>Pay securely online</strong>
                      <small>
                        Pay with Paystack now. Your order updates automatically after confirmation.
                      </small>
                    </span>
                  </label>
                )}
                {quote?.settings.bankTransferEnabled && (
                  <label className={styles.paymentChoice}>
                    <input
                      type="radio"
                      name="paymentChoice"
                      value="BANK_TRANSFER"
                      checked={paymentChoice === 'BANK_TRANSFER'}
                      onChange={() => setPaymentChoice('BANK_TRANSFER')}
                    />
                    <span>
                      <strong>Transfer to the store’s bank account</strong>
                      <small>
                        Your order is marked paid after the store verifies your transfer.
                      </small>
                    </span>
                  </label>
                )}
              </div>
            </fieldset>
            {state.error && (
              <p className={styles.error} role="alert">
                {state.error}
              </p>
            )}
            <button
              className={styles.placeOrder}
              type="submit"
              disabled={
                submitting ||
                loading ||
                unavailable ||
                (paymentChoice === 'BANK_TRANSFER'
                  ? !quote?.settings.bankTransferEnabled
                  : !quote?.settings.paystackEnabled)
              }
            >
              {submitting
                ? 'Placing your order…'
                : `Place order · ${formatMoney(subtotal + (chosenRate?.amount ?? 0), currency)}`}
            </button>
          </form>
        )}
      </section>
      <aside className={styles.orderSummary}>
        <h2>Order summary</h2>
        <dl className={styles.summaryList}>
          <div>
            <dt>Products</dt>
            <dd>{formatMoney(subtotal, currency)}</dd>
          </div>
          <div>
            <dt>Delivery</dt>
            <dd>
              {chosenRate
                ? chosenRate.amount
                  ? formatMoney(chosenRate.amount, currency)
                  : 'Free'
                : step === 'checkout' && quote?.shippingRates.length
                  ? 'Choose an option'
                  : 'No fee'}
            </dd>
          </div>
          <div className={styles.total}>
            <dt>Total</dt>
            <dd>{formatMoney(subtotal + (chosenRate?.amount ?? 0), currency)}</dd>
          </div>
        </dl>
        {step === 'cart' && (
          <Link
            className={`${styles.primaryLink} ${unavailable || loading ? styles.disabledLink : ''}`}
            aria-disabled={unavailable || loading}
            tabIndex={unavailable || loading ? -1 : undefined}
            href={unavailable || loading ? '#' : `/store/${slug}/checkout`}
          >
            Continue to checkout
          </Link>
        )}
        {step === 'checkout' && (
          <Link className={styles.secondaryLink} href={`/store/${slug}/cart`}>
            Return to cart
          </Link>
        )}
      </aside>
    </div>
  );
}
