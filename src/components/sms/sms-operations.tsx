'use client';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { FormError, FormStack } from '@/components/ui/form-layout';
import {
  processSmsQueue,
  refreshSmsSenderStatuses,
  rejectSmsSenderRequest,
  submitSmsSenderRequest,
} from '@/modules/sms/actions';
import type { SmsDeliveryMode, SmsLog, SmsSenderRequest } from '@/modules/sms/types';
import { SmsLogList } from './sms-log-list';
import styles from './sms.module.css';

function label(value: string) {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^./, (character) => character.toUpperCase());
}

function SenderReviewButton({ tenantId }: { tenantId: string }) {
  const [state, action, pending] = useActionState(submitSmsSenderRequest.bind(null, tenantId), {
    error: '',
    message: '',
  });
  return (
    <FormStack action={action} aria-busy={pending}>
      <Button type="submit" disabled={pending}>
        {pending ? 'Submitting…' : 'Approve and send to Termii'}
      </Button>
      <FormError message={state.error} />
      {state.message && <small role="status">{state.message}</small>}
    </FormStack>
  );
}

function SenderRejectButton({ tenantId }: { tenantId: string }) {
  const [state, action, pending] = useActionState(rejectSmsSenderRequest.bind(null, tenantId), {
    error: '',
    message: '',
  });
  return (
    <FormStack action={action} aria-busy={pending}>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? 'Returning…' : 'Return for correction'}
      </Button>
      <FormError message={state.error} />
      {state.message && <small role="status">{state.message}</small>}
    </FormStack>
  );
}

export function SmsSenderRequests({ requests }: { requests: SmsSenderRequest[] }) {
  const [state, refreshAction, pending] = useActionState(refreshSmsSenderStatuses, {
    error: '',
    message: '',
  });
  return (
    <div className={styles.stack}>
      <div className={styles.operationsHeader}>
        <p>Review each business identity before submitting it to Termii and the mobile networks.</p>
        <FormStack action={refreshAction} aria-busy={pending}>
          <Button type="submit" variant="secondary" disabled={pending}>
            {pending ? 'Checking approvals…' : 'Check Termii approvals'}
          </Button>
          <FormError message={state.error} />
          {state.message && <small role="status">{state.message}</small>}
        </FormStack>
      </div>
      {!requests.length ? (
        <p>No businesses have requested a sender name yet.</p>
      ) : (
        <div className={styles.requestList}>
          {requests.map((request) => (
            <article className={styles.request} key={request.tenant_id}>
              <div>
                <strong>{request.business_name}</strong>
                <p>
                  Wants customers to see <strong>{request.requested_sender_id}</strong>
                </p>
                <small>{request.sender_company_name}</small>
                <small>{request.sender_use_case}</small>
              </div>
              <div>
                <span className={styles.status}>{label(request.sender_id_status)}</span>
                {request.sender_status_message && <small>{request.sender_status_message}</small>}
              </div>
              {request.sender_id_status === 'PENDING_REVIEW' && (
                <div className={styles.stack}>
                  <SenderReviewButton tenantId={request.tenant_id} />
                  <SenderRejectButton tenantId={request.tenant_id} />
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function SmsDeliveryOperations({
  logs,
  mode,
  configured,
}: {
  logs: SmsLog[];
  mode: SmsDeliveryMode;
  configured: boolean;
}) {
  const [state, action, pending] = useActionState(processSmsQueue, { error: '', message: '' });
  return (
    <div className={styles.stack}>
      <div className={styles.operationsHeader}>
        <p className={styles.notice}>
          Delivery mode: <strong>{mode}</strong>.{' '}
          {configured
            ? 'Termii is configured for this environment.'
            : 'Messages remain safely queued until Termii is configured and enabled.'}
        </p>
        <FormStack action={action} aria-busy={pending}>
          <Button type="submit" disabled={pending || !configured}>
            {pending ? 'Processing…' : 'Process queued text messages'}
          </Button>
          <FormError message={state.error} />
          {state.message && <small role="status">{state.message}</small>}
        </FormStack>
      </div>
      <SmsLogList logs={logs} platform allowRetry />
    </div>
  );
}
