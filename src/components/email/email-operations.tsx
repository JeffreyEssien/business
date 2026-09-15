'use client';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { FormError, FormStack } from '@/components/ui/form-layout';
import { processEmailQueue } from '@/modules/email/actions';
import type { EmailDeliveryMode, EmailLog } from '@/modules/email/types';
import { EmailLogList } from './email-log-list';
import styles from './email.module.css';

export function EmailOperations({
  logs,
  mode,
  configured,
}: {
  logs: EmailLog[];
  mode: EmailDeliveryMode;
  configured: boolean;
}) {
  const [state, action, pending] = useActionState(processEmailQueue, { error: '', message: '' });
  return (
    <div className={styles.stack}>
      <div className={styles.operationsHeader}>
        <p className={styles.notice}>
          Delivery mode: <strong>{mode}</strong>.{' '}
          {configured
            ? 'Resend is configured for this environment.'
            : 'Messages remain safely queued until Resend is configured.'}
        </p>
        <FormStack action={action} aria-busy={pending}>
          <Button type="submit" disabled={pending || !configured}>
            {pending ? 'Processing…' : 'Process queued emails'}
          </Button>
          <FormError message={state.error} />
          {state.message && <p role="status">{state.message}</p>}
        </FormStack>
      </div>
      <EmailLogList logs={logs} platform allowRetry />
    </div>
  );
}
