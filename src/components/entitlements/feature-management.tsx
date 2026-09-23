'use client';

import { useActionState, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-layout';
import {
  removeTenantOverride,
  saveFeatureGlobalState,
  savePlanFeature,
  saveTenantOverride,
} from '@/modules/entitlements/actions';
import type {
  EntitlementPlan,
  FeatureDefinition,
  FeatureManagementData,
  FeatureValue,
} from '@/modules/entitlements/types';
import styles from './feature-management.module.css';

const initialState = { error: '', message: '' };

function displayValue(value: FeatureValue) {
  if (value === null) return 'Unlimited';
  if (typeof value === 'boolean') return value ? 'Included' : 'Not included';
  return String(value);
}

function ValueControl({
  feature,
  value,
  id,
}: {
  feature: FeatureDefinition;
  value: FeatureValue;
  id?: string;
}) {
  if (feature.value_type === 'BOOLEAN')
    return (
      <select
        id={id}
        name="value"
        defaultValue={String(value)}
        aria-label={id ? undefined : `${feature.name} value`}
      >
        <option value="true">Included</option>
        <option value="false">Not included</option>
      </select>
    );
  return (
    <input
      name="value"
      id={id}
      type="number"
      min="0"
      max="1000000"
      step="1"
      defaultValue={value === null ? '' : String(value)}
      placeholder="Unlimited"
      aria-label={id ? undefined : `${feature.name} limit; leave empty for unlimited`}
    />
  );
}

function PlanValueForm({
  feature,
  plan,
  value,
}: {
  feature: FeatureDefinition;
  plan: EntitlementPlan;
  value: FeatureValue;
}) {
  const [state, action, pending] = useActionState(savePlanFeature, initialState);
  return (
    <form action={action} className={styles.inlineForm} aria-busy={pending}>
      <input type="hidden" name="plan" value={plan.slug} />
      <input type="hidden" name="feature" value={feature.key} />
      <input type="hidden" name="valueType" value={feature.value_type} />
      <ValueControl feature={feature} value={value} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </Button>
      <FormError message={state.error} />
      {state.message && <span className={styles.success}>{state.message}</span>}
    </form>
  );
}

function GlobalStateForm({
  feature,
  enabled,
  reason,
}: {
  feature: FeatureDefinition;
  enabled: boolean;
  reason: string | null;
}) {
  const [state, action, pending] = useActionState(saveFeatureGlobalState, initialState);
  return (
    <form action={action} className={styles.globalForm} aria-busy={pending}>
      <input type="hidden" name="feature" value={feature.key} />
      <input type="hidden" name="enabled" value={enabled ? 'false' : 'true'} />
      <div>
        <strong>{feature.name}</strong>
        <p>{enabled ? 'Available according to each plan and override.' : reason}</p>
      </div>
      {enabled && (
        <div className={styles.field}>
          <label htmlFor={`global-reason-${feature.key}`}>Emergency shutdown reason</label>
          <input
            id={`global-reason-${feature.key}`}
            name="reason"
            minLength={3}
            maxLength={500}
            required
          />
        </div>
      )}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? 'Updating…' : enabled ? 'Pause globally' : 'Restore feature'}
      </Button>
      <FormError message={state.error} />
      {state.message && <span className={styles.success}>{state.message}</span>}
    </form>
  );
}

function OverrideForm({ data }: { data: FeatureManagementData }) {
  const [state, action, pending] = useActionState(saveTenantOverride, initialState);
  const [featureKey, setFeatureKey] = useState(data.features[0]?.key ?? '');
  const feature = data.features.find((item) => item.key === featureKey) ?? data.features[0];
  if (!feature || data.tenants.length === 0) return <p>No eligible business is available.</p>;
  return (
    <form action={action} className={styles.overrideForm} aria-busy={pending}>
      <div className={styles.field}>
        <label htmlFor="override-tenant">Business</label>
        <select id="override-tenant" name="tenant" required>
          {data.tenants.map((tenant) => (
            <option value={tenant.id} key={tenant.id}>
              {tenant.name} · {tenant.slug}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.field}>
        <label htmlFor="override-feature">Feature</label>
        <select
          id="override-feature"
          name="feature"
          value={featureKey}
          onChange={(event) => setFeatureKey(event.target.value)}
          required
        >
          {data.features.map((item) => (
            <option value={item.key} key={item.key}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      <input type="hidden" name="valueType" value={feature.value_type} />
      <div className={styles.field}>
        <label htmlFor="override-value">Override value</label>
        <ValueControl id="override-value" feature={feature} value={feature.default_value} />
        {feature.value_type === 'INTEGER' && <small>Leave empty for unlimited.</small>}
      </div>
      <div className={styles.field}>
        <label htmlFor="override-reason">Reason</label>
        <textarea id="override-reason" name="reason" minLength={3} maxLength={500} required />
      </div>
      <div className={styles.field}>
        <label htmlFor="override-expiry">Expiry (optional)</label>
        <input id="override-expiry" name="expiresAt" type="datetime-local" />
      </div>
      <FormError message={state.error} />
      {state.message && <p className={styles.success}>{state.message}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving override…' : 'Save business override'}
      </Button>
    </form>
  );
}

function OverrideRow({
  override,
  tenantName,
  featureName,
  now,
  businessSearch,
}: {
  override: FeatureManagementData['overrides'][number];
  tenantName: string;
  featureName: string;
  now: number;
  businessSearch: string;
}) {
  const [state, action, pending] = useActionState(removeTenantOverride, initialState);
  const expired = Boolean(override.expires_at && new Date(override.expires_at).getTime() <= now);
  return (
    <div className={styles.overrideRow}>
      <div>
        <strong>
          {tenantName} {expired && <span className={styles.expired}>Expired</span>}
        </strong>
        <p>
          {featureName}: {displayValue(override.value)} · {override.reason}
        </p>
        {override.expires_at && (
          <small>
            {expired ? 'Expired' : 'Expires'} {new Date(override.expires_at).toLocaleString()}
            {expired ? ' · The plan value is active now.' : ''}
          </small>
        )}
      </div>
      <form action={action} aria-busy={pending}>
        <input type="hidden" name="tenant" value={override.tenant_id} />
        <input type="hidden" name="feature" value={override.feature_key} />
        <input type="hidden" name="businessSearch" value={businessSearch} />
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? 'Removing…' : 'Return to plan'}
        </Button>
        <FormError message={state.error} />
      </form>
    </div>
  );
}

export function FeatureManagement({
  data,
  now,
  notice,
}: {
  data: FeatureManagementData;
  now: number;
  notice: string;
}) {
  const values = new Map(
    data.planValues.map((item) => [`${item.plan_id}:${item.feature_key}`, item.value]),
  );
  const global = new Map(data.globalStates.map((item) => [item.feature_key, item]));
  return (
    <div className={styles.stack}>
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      <section className={styles.section} aria-labelledby="plan-matrix-heading">
        <div className={styles.heading}>
          <div>
            <h2 id="plan-matrix-heading">Plan feature matrix</h2>
            <p>Changes take effect immediately. Empty numeric limits mean unlimited.</p>
            <p>
              Lower limits preserve existing products. A business already above its new allowance
              cannot add or restore products until usage is reduced.
            </p>
          </div>
        </div>
        <div className={styles.matrix}>
          {data.features.map((feature) => (
            <article className={styles.featureRow} key={feature.key}>
              <div className={styles.featureDescription}>
                <span>{feature.category}</span>
                <h3>{feature.name}</h3>
                <p>{feature.description}</p>
              </div>
              <div className={styles.planGrid}>
                {data.plans.map((plan) => (
                  <div className={styles.planCell} key={plan.id}>
                    <strong>{plan.name}</strong>
                    <PlanValueForm
                      plan={plan}
                      feature={feature}
                      value={
                        values.has(`${plan.id}:${feature.key}`)
                          ? (values.get(`${plan.id}:${feature.key}`) ?? null)
                          : feature.default_value
                      }
                    />
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="global-state-heading">
        <div className={styles.heading}>
          <div>
            <h2 id="global-state-heading">Emergency controls</h2>
            <p>Pause an integration for every business during an incident. This overrides plans.</p>
          </div>
        </div>
        <div className={styles.globalList}>
          {data.features
            .filter((feature) => feature.value_type === 'BOOLEAN')
            .map((feature) => {
              const state = global.get(feature.key);
              return (
                <GlobalStateForm
                  key={feature.key}
                  feature={feature}
                  enabled={state?.enabled ?? true}
                  reason={state?.reason ?? null}
                />
              );
            })}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="override-heading">
        <div className={styles.heading}>
          <div>
            <h2 id="override-heading">Business overrides</h2>
            <p>Grant or restrict one feature without changing the business plan.</p>
          </div>
        </div>
        <div className={styles.overrideLayout}>
          <div>
            <form className={styles.searchForm} action="/features">
              <label htmlFor="business-search">Find a business</label>
              <div>
                <input
                  id="business-search"
                  name="business"
                  defaultValue={data.businessSearch}
                  placeholder="Search by business name"
                />
                <Button type="submit" variant="secondary">
                  Search
                </Button>
              </div>
              <small>Showing up to 50 matching businesses.</small>
            </form>
            <OverrideForm data={data} />
          </div>
          <ExistingOverridesWithTime data={data} now={now} />
        </div>
      </section>
    </div>
  );
}

function ExistingOverridesWithTime({ data, now }: { data: FeatureManagementData; now: number }) {
  const tenantNames = useMemo(
    () => new Map(data.tenants.map((tenant) => [tenant.id, tenant.name])),
    [data.tenants],
  );
  if (data.overrides.length === 0)
    return <p className={styles.empty}>No business overrides. Every business follows its plan.</p>;
  return (
    <div className={styles.overrideList}>
      {data.overrides.map((override) => (
        <OverrideRow
          key={`${override.tenant_id}-${override.feature_key}`}
          override={override}
          tenantName={
            override.tenant?.[0]?.name ?? tenantNames.get(override.tenant_id) ?? 'Unknown business'
          }
          featureName={
            data.features.find((feature) => feature.key === override.feature_key)?.name ??
            override.feature_key
          }
          now={now}
          businessSearch={data.businessSearch}
        />
      ))}
    </div>
  );
}
