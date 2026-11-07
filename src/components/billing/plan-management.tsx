'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-layout';
import { savePlan } from '@/modules/billing/actions';
import { BILLING_INTERVALS } from '@/modules/billing/validation';
import type { Plan, PlanManagementData } from '@/modules/billing/types';
import { formatMoney } from '@/modules/commerce/money';
import styles from './plan-management.module.css';

const initialState = { error: '', message: '' };

function intervalLabel(plan: Plan) {
  return (
    BILLING_INTERVALS.find((interval) => interval.value === plan.billing_interval)?.label ?? ''
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const [state, action, pending] = useActionState(savePlan, initialState);
  const nameId = `plan-name-${plan.slug}`;
  const descriptionId = `plan-description-${plan.slug}`;
  const priceId = `plan-price-${plan.slug}`;
  const currencyId = `plan-currency-${plan.slug}`;
  const intervalId = `plan-interval-${plan.slug}`;
  const orderId = `plan-order-${plan.slug}`;
  return (
    <form action={action} className={styles.card} aria-busy={pending}>
      <input type="hidden" name="plan" value={plan.slug} />
      <div className={styles.cardHeading}>
        <div>
          <span className={styles.slug}>{plan.slug}</span>
          <h3>{plan.name}</h3>
        </div>
        <p className={styles.summary}>
          {formatMoney(plan.price, plan.currency)} · {intervalLabel(plan)}
          <span className={plan.is_public ? styles.badgePublic : styles.badgeHidden}>
            {plan.is_public ? 'Shown to new businesses' : 'Hidden'}
          </span>
        </p>
      </div>

      <div className={styles.field}>
        <label htmlFor={nameId}>Plan name</label>
        <input id={nameId} name="name" defaultValue={plan.name} maxLength={80} required />
      </div>

      <div className={styles.field}>
        <label htmlFor={descriptionId}>What this plan includes</label>
        <textarea
          id={descriptionId}
          name="description"
          defaultValue={plan.description}
          maxLength={500}
          placeholder="A short summary a business owner sees when choosing a plan."
        />
      </div>

      <div className={styles.inline}>
        <div className={styles.field}>
          <label htmlFor={priceId}>Price</label>
          <input
            id={priceId}
            name="price"
            type="number"
            min="0"
            max="100000000"
            step="0.01"
            defaultValue={plan.price}
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor={currencyId}>Currency</label>
          <input
            id={currencyId}
            name="currency"
            defaultValue={plan.currency}
            maxLength={3}
            pattern="[A-Za-z]{3}"
            required
          />
        </div>
      </div>

      <div className={styles.inline}>
        <div className={styles.field}>
          <label htmlFor={intervalId}>Charged</label>
          <select id={intervalId} name="billingInterval" defaultValue={plan.billing_interval}>
            {BILLING_INTERVALS.map((interval) => (
              <option value={interval.value} key={interval.value}>
                {interval.label}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor={orderId}>Display order</label>
          <input
            id={orderId}
            name="sortOrder"
            type="number"
            min="0"
            max="1000"
            step="1"
            defaultValue={plan.sort_order}
            required
          />
        </div>
      </div>

      <label className={styles.toggle}>
        <input type="checkbox" name="isPublic" defaultChecked={plan.is_public} />
        <span>Show this plan to new businesses choosing a plan</span>
      </label>

      <div className={styles.actions}>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save plan'}
        </Button>
        <FormError message={state.error} />
        {state.message && (
          <span className={styles.success} role="status">
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}

export function PlanManagement({ data }: { data: PlanManagementData }) {
  if (data.plans.length === 0) return <p className={styles.empty}>No plans exist yet.</p>;
  return (
    <div className={styles.grid}>
      {data.plans.map((plan) => (
        <PlanCard key={plan.id} plan={plan} />
      ))}
    </div>
  );
}
