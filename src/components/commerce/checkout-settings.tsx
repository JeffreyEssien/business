'use client';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import {
  FormActions,
  FormError,
  FormGrid,
  FormSection,
  FormStack,
} from '@/components/ui/form-layout';
import { SelectField, TextAreaField, TextField } from '@/components/ui/form-fields';
import {
  connectPaystackSettlement,
  removeShippingRate,
  saveBankAccount,
  saveCheckoutSettings,
  saveShippingRate,
} from '@/modules/commerce/actions';
import { formatMoney } from '@/modules/commerce/money';
import type {
  CheckoutSettings,
  StoredBankAccount,
  StoredShippingRate,
  TenantPaymentSettings,
} from '@/modules/commerce/types';
import type { SettlementBank } from '@/modules/payments/types';
import styles from './order-admin.module.css';

const initial = { error: '', message: '' };
function Result({ error, message }: typeof initial) {
  return (
    <>
      {<FormError message={error} />}
      {message && (
        <p className={styles.saved} role="status">
          {message}
        </p>
      )}
    </>
  );
}

export function BankAccountForm({
  slug,
  account,
}: {
  slug: string;
  account: StoredBankAccount | null;
}) {
  const [state, action, pending] = useActionState(saveBankAccount.bind(null, slug), initial);
  return (
    <FormStack action={action}>
      <FormSection
        title="Bank-transfer account"
        description="Customers see these details only after successfully placing an order."
      >
        <FormGrid>
          <TextField
            name="bankName"
            label="Bank name"
            required
            maxLength={100}
            defaultValue={account?.bank_name}
          />
          <TextField
            name="accountNumber"
            label="Bank-transfer account number"
            inputMode="numeric"
            required
            minLength={6}
            maxLength={20}
            defaultValue={account?.account_number}
          />
          <TextField
            name="accountName"
            label="Account name"
            required
            maxLength={160}
            defaultValue={account?.account_name}
          />
        </FormGrid>
        <TextAreaField
          name="instructions"
          label="Extra payment instructions (optional)"
          hint="For example, ask customers to include their order reference."
          maxLength={1000}
          defaultValue={account?.instructions}
        />
      </FormSection>
      <Result {...state} />
      <FormActions note="Saving replaces the active account shown for new orders. Existing orders keep their original payment details.">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving account…' : 'Save bank account'}
        </Button>
      </FormActions>
    </FormStack>
  );
}

export function CheckoutSettingsForm({
  slug,
  settings,
  bankAccountReady,
}: {
  slug: string;
  settings: CheckoutSettings;
  bankAccountReady: boolean;
}) {
  const [state, action, pending] = useActionState(saveCheckoutSettings.bind(null, slug), initial);
  return (
    <FormStack action={action}>
      <FormSection
        title="Choose the payment methods shown at checkout"
        description="Customers will choose from the methods you enable here. At least one method must remain available."
      >
        <div className={styles.checks}>
          <label>
            <input
              type="checkbox"
              name="bankTransfer"
              defaultChecked={settings.bank_transfer_enabled}
              disabled={!bankAccountReady}
            />{' '}
            Accept orders paid by manual bank transfer
          </label>
          {!bankAccountReady && (
            <p className={styles.fieldNotice}>
              Save your bank-transfer account below before turning on manual transfers.
            </p>
          )}
          <label>
            <input
              type="checkbox"
              name="paystack"
              defaultChecked={settings.paystack_enabled}
              disabled={!settings.paystack_account_ready}
            />{' '}
            Accept card, bank, and other secure online payments through Paystack
          </label>
          {!settings.paystack_account_ready && (
            <p className={styles.fieldNotice}>
              Connect a Paystack settlement account below before turning on secure online payments.
            </p>
          )}
        </div>
      </FormSection>
      <FormSection
        title="Customer information and confirmation"
        description="Only ask customers for information needed to prepare and deliver their orders."
      >
        <div className={styles.checks}>
          <label>
            <input type="checkbox" name="collectEmail" defaultChecked={settings.collect_email} />{' '}
            Require an email address
          </label>
          <label>
            <input type="checkbox" name="collectPhone" defaultChecked={settings.collect_phone} />{' '}
            Require a phone number
          </label>
          <label>
            <input
              type="checkbox"
              name="collectAddress"
              defaultChecked={settings.collect_delivery_address}
            />{' '}
            Require a delivery address unless pickup is selected
          </label>
          <label>
            <input
              type="checkbox"
              name="orderNotes"
              defaultChecked={settings.order_notes_enabled}
            />{' '}
            Let customers add an order note
          </label>
        </div>
        <TextAreaField
          name="successMessage"
          label="Message shown after an order is placed"
          required
          maxLength={500}
          defaultValue={settings.success_message}
        />
      </FormSection>
      <Result {...state} />
      <FormActions note="These choices affect the live checkout immediately. BusinessCare will not save the form unless at least one fully configured payment method remains enabled.">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving checkout…' : 'Save checkout choices'}
        </Button>
      </FormActions>
    </FormStack>
  );
}

export function PaystackSettlementForm({
  slug,
  settings,
  banks,
}: {
  slug: string;
  settings: TenantPaymentSettings;
  banks: SettlementBank[];
}) {
  const [state, action, pending] = useActionState(
    connectPaystackSettlement.bind(null, slug),
    initial,
  );
  const connected = settings.connection_status === 'ACTIVE';
  return (
    <FormStack action={action}>
      <FormSection
        title={connected ? 'Settlement account connected' : 'Connect your settlement account'}
        description="Paystack verifies this account and sends your share of each online payment to it. BusinessCare stores only the account name and final four digits."
      >
        {connected && (
          <div className={styles.settlementSummary}>
            <strong>{settings.settlement_account_name}</strong>
            <span>
              {settings.settlement_bank_name} · account ending {settings.settlement_account_last4}
            </span>
          </div>
        )}
        {banks.length ? (
          <FormGrid>
            <SelectField
              name="bankCode"
              label="Settlement bank"
              options={banks.map((bank) => ({ value: bank.code, label: bank.name }))}
              defaultValue={settings.settlement_bank_code}
              required
            />
            <TextField
              name="settlementAccountNumber"
              label={connected ? 'New account number' : 'Account number'}
              hint={connected ? 'Enter all 10 digits to replace the connected account.' : undefined}
              inputMode="numeric"
              autoComplete="off"
              minLength={10}
              maxLength={10}
              pattern="[0-9]{10}"
              required
            />
          </FormGrid>
        ) : (
          <p className={styles.fieldNotice}>
            Paystack bank verification is temporarily unavailable. Your existing payment choices
            have not changed.
          </p>
        )}
      </FormSection>
      <Result {...state} />
      {banks.length > 0 && (
        <FormActions note="Paystack will confirm the account name before BusinessCare saves the connection.">
          <Button type="submit" disabled={pending}>
            {pending
              ? 'Verifying settlement account…'
              : connected
                ? 'Verify and replace account'
                : 'Verify and connect account'}
          </Button>
        </FormActions>
      )}
    </FormStack>
  );
}

export function DeliveryOptions({ slug, rates }: { slug: string; rates: StoredShippingRate[] }) {
  const [state, action, pending] = useActionState(saveShippingRate.bind(null, slug), initial);
  return (
    <div className={styles.deliverySettings}>
      {rates.length ? (
        <div className={styles.rateList}>
          {rates.map((rate) => {
            const zone = Array.isArray(rate.shipping_zones)
              ? rate.shipping_zones[0]
              : rate.shipping_zones;
            return (
              <article key={rate.id}>
                <div>
                  <strong>{rate.name}</strong>
                  <p>
                    {zone?.name ?? 'Delivery'} ·{' '}
                    {rate.amount ? formatMoney(rate.amount, 'NGN') : 'Free'}
                    {rate.rule_jsonb.pickup ? ' · Customer pickup' : ''}
                  </p>
                  {rate.rule_jsonb.states?.length ? (
                    <small>Available in: {rate.rule_jsonb.states.join(', ')}</small>
                  ) : (
                    <small>Available in every state</small>
                  )}
                </div>
                <form action={removeShippingRate.bind(null, slug, rate.id)}>
                  <Button type="submit" variant="secondary">
                    Remove
                  </Button>
                </form>
              </article>
            );
          })}
        </div>
      ) : (
        <p className={styles.emptyMessage}>
          No delivery or pickup options yet. Add one before accepting orders that need delivery.
        </p>
      )}
      <FormStack action={action}>
        <FormSection
          title="Add a delivery or pickup option"
          description="Use one flat fee for the selected states. Add more options when different areas need different prices."
        >
          <FormGrid>
            <TextField
              name="rateName"
              label="Name customers will see"
              placeholder="Lagos delivery"
              required
              maxLength={100}
            />
            <TextField
              name="zoneName"
              label="Internal region name"
              placeholder="Lagos"
              required
              maxLength={100}
            />
            <TextField
              name="amount"
              label="Fee in NGN"
              type="number"
              min="0"
              step="0.01"
              required
            />
            <TextField
              name="states"
              label="Available states (optional)"
              hint="Separate state names with commas. Leave blank to offer it everywhere."
              placeholder="Lagos, Ogun"
            />
          </FormGrid>
          <label className={styles.pickupCheck}>
            <input name="pickup" type="checkbox" /> This is customer pickup, so no delivery address
            is required
          </label>
        </FormSection>
        <Result {...state} />
        <FormActions>
          <Button type="submit" disabled={pending}>
            {pending ? 'Adding option…' : 'Add delivery option'}
          </Button>
        </FormActions>
      </FormStack>
    </div>
  );
}
