'use client';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/form-fields';
import { FormActions, FormError, FormGrid, FormStack } from '@/components/ui/form-layout';
import { saveTenantEmailSettings } from '@/modules/email/actions';
import type { EmailSettings } from '@/modules/email/types';
import styles from './email.module.css';

const choices = [
  [
    'orderCreated',
    'order_created_enabled',
    'Order received',
    'Confirms that the store received the customer’s order.',
  ],
  [
    'paymentSuccess',
    'payment_success_enabled',
    'Payment received',
    'Confirms payment only after the store or Paystack verifies it.',
  ],
  [
    'orderReady',
    'order_ready_enabled',
    'Order ready',
    'Tells the customer that pickup or delivery preparation is complete.',
  ],
  [
    'orderShipped',
    'order_shipped_enabled',
    'Order on the way',
    'Tells the customer when the order has been shipped.',
  ],
  [
    'orderDelivered',
    'order_delivered_enabled',
    'Order delivered',
    'Closes the delivery journey with a clear confirmation.',
  ],
] as const;

export function EmailSettingsForm({
  slug,
  settings,
  defaultSenderName,
  deliveryReady,
}: {
  slug: string;
  settings: EmailSettings;
  defaultSenderName: string;
  deliveryReady: boolean;
}) {
  const action = saveTenantEmailSettings.bind(null, slug);
  const [state, submitAction, pending] = useActionState(action, { error: '', message: '' });
  return (
    <FormStack action={submitAction} aria-busy={pending}>
      {!deliveryReady && (
        <p className={styles.notice}>
          You can prepare these choices now. BusinessCare will keep emails queued until platform
          delivery is connected and safely enabled.
        </p>
      )}
      <label className={styles.choice}>
        <input name="enabled" type="checkbox" defaultChecked={settings.enabled} />
        <span>
          <strong>Send automatic order updates to customers</strong>
          <small>Only the individual updates selected below will be sent.</small>
        </span>
      </label>
      <FormGrid>
        <TextField
          name="fromName"
          label="Sender name customers will see"
          hint={`Leave blank to use “${defaultSenderName}”.`}
          defaultValue={settings.from_name}
          maxLength={100}
        />
        <TextField
          name="replyTo"
          label="Where customer replies should go"
          hint="Leave blank to use the store contact email."
          type="email"
          defaultValue={settings.reply_to}
          maxLength={254}
        />
      </FormGrid>
      <div className={styles.stack}>
        {choices.map(([name, key, label, description]) => (
          <label className={styles.choice} key={name}>
            <input name={name} type="checkbox" defaultChecked={settings[key]} />
            <span>
              <strong>{label}</strong>
              <small>{description}</small>
            </span>
          </label>
        ))}
      </div>
      <FormError message={state.error} />
      {state.message && (
        <p className={styles.success} role="status">
          {state.message}
        </p>
      )}
      <FormActions note="Changing these choices affects new order events. Previously queued emails keep their original branding and wording.">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving email choices…' : 'Save customer email choices'}
        </Button>
      </FormActions>
    </FormStack>
  );
}
