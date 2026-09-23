'use client';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { TextAreaField, TextField } from '@/components/ui/form-fields';
import { FormActions, FormError, FormStack } from '@/components/ui/form-layout';
import { requestTenantSmsSender, saveTenantSmsSettings } from '@/modules/sms/actions';
import type { SmsSettings } from '@/modules/sms/types';
import styles from './sms.module.css';

const choices = [
  [
    'orderCreated',
    'order_created_enabled',
    'Order received',
    'Confirms that the store received the order.',
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
    'Tells the customer that preparation is complete.',
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
    'Confirms that the order was delivered.',
  ],
] as const;

function senderStatus(settings: SmsSettings) {
  switch (settings.sender_id_status) {
    case 'PENDING_REVIEW':
      return 'BusinessCare is reviewing this sender name before sending it to Termii.';
    case 'PENDING_PROVIDER':
      return 'Termii and the mobile networks are reviewing this sender name.';
    case 'APPROVED':
      return `${settings.approved_sender_id} is approved and ready for customer messages.`;
    case 'REJECTED':
      return 'The sender name was not approved. Review the note below and submit another name.';
    case 'REQUEST_FAILED':
      return 'The request did not reach Termii. You can submit it again.';
    default:
      return 'Choose the short business name customers should see when a text message arrives.';
  }
}

export function SmsSenderRequestForm({
  slug,
  settings,
  businessName,
  entitled,
}: {
  slug: string;
  settings: SmsSettings;
  businessName: string;
  entitled: boolean;
}) {
  const [state, action, pending] = useActionState(requestTenantSmsSender.bind(null, slug), {
    error: '',
    message: '',
  });
  const canRequest = ['NOT_REQUESTED', 'REJECTED', 'REQUEST_FAILED'].includes(
    settings.sender_id_status,
  );
  if (!entitled)
    return (
      <p className={styles.locked}>
        Customer text messages are available on Growth and Pro. This Starter business cannot turn
        them on or bypass that limit through the API.
      </p>
    );
  return (
    <div className={styles.stack}>
      <p className={styles.notice}>
        <strong>{settings.requested_sender_id || 'No sender name requested'}:</strong>{' '}
        {senderStatus(settings)}
        {settings.sender_status_message ? ` ${settings.sender_status_message}` : ''}
      </p>
      {state.message && <p className={styles.success}>{state.message}</p>}
      {canRequest && (
        <FormStack action={action} aria-busy={pending}>
          <TextField
            name="senderId"
            label="Short name customers will see"
            hint="Use 3–11 letters or numbers, such as FRESHCUTS. Include at least one letter."
            defaultValue={settings.requested_sender_id}
            minLength={3}
            maxLength={11}
            pattern="(?=.*[A-Za-z])[A-Za-z0-9 ]{3,11}"
            required
          />
          <TextField
            name="companyName"
            label="Registered or trading business name"
            defaultValue={settings.sender_company_name || businessName}
            minLength={2}
            maxLength={160}
            required
          />
          <TextAreaField
            name="useCase"
            label="Messages customers will receive"
            hint="Describe only transactional order updates. Promotional messages are not part of this phase."
            defaultValue={
              settings.sender_use_case ||
              'Order received, verified payment, preparation, shipping, and delivery updates.'
            }
            minLength={10}
            maxLength={320}
            required
          />
          <FormError message={state.error} />
          <FormActions note="BusinessCare reviews the request before it reaches Termii. Messages remain off until approval.">
            <Button type="submit" disabled={pending}>
              {pending ? 'Submitting sender name…' : 'Submit sender name for review'}
            </Button>
          </FormActions>
        </FormStack>
      )}
    </div>
  );
}

export function SmsSettingsForm({
  slug,
  settings,
  entitled,
  deliveryReady,
}: {
  slug: string;
  settings: SmsSettings;
  entitled: boolean;
  deliveryReady: boolean;
}) {
  const [state, action, pending] = useActionState(saveTenantSmsSettings.bind(null, slug), {
    error: '',
    message: '',
  });
  const approved = entitled && settings.sender_id_status === 'APPROVED';
  return (
    <FormStack action={action} aria-busy={pending}>
      {!deliveryReady && (
        <p className={styles.notice}>
          You can prepare these choices now. BusinessCare will keep eligible messages queued until
          platform delivery is safely enabled.
        </p>
      )}
      <label className={styles.choice}>
        <input
          name="enabled"
          type="checkbox"
          defaultChecked={settings.enabled}
          disabled={!approved}
        />
        <span>
          <strong>Send automatic order updates by text message</strong>
          <small>
            {approved
              ? 'Only the individual updates selected below will be sent.'
              : 'This becomes available after the business plan and sender name are approved.'}
          </small>
        </span>
      </label>
      <div className={styles.stack}>
        {choices.map(([name, key, label, description]) => (
          <label className={styles.choice} key={name}>
            <input
              name={name}
              type="checkbox"
              defaultChecked={settings[key]}
              disabled={!entitled}
            />
            <span>
              <strong>{label}</strong>
              <small>{description}</small>
            </span>
          </label>
        ))}
      </div>
      <FormError message={state.error} />
      {state.message && <p className={styles.success}>{state.message}</p>}
      <FormActions note="These choices affect new order events. Previously queued messages keep their original sender and wording.">
        <Button type="submit" disabled={pending || !entitled}>
          {pending ? 'Saving text-message choices…' : 'Save text-message choices'}
        </Button>
      </FormActions>
    </FormStack>
  );
}
