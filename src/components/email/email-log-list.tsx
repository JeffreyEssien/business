import type { EmailLog } from '@/modules/email/types';
import { RetryEmailButton } from './retry-email-button';
import styles from './email.module.css';

function label(value: string) {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^./, (character) => character.toUpperCase());
}

export function EmailLogList({
  logs,
  platform = false,
  allowRetry = false,
}: {
  logs: EmailLog[];
  platform?: boolean;
  allowRetry?: boolean;
}) {
  if (!logs.length)
    return (
      <p>No customer emails have been queued yet. New enabled order events will appear here.</p>
    );
  return (
    <div className={styles.logList}>
      {logs.map((log) => (
        <article className={styles.logRow} key={log.id}>
          <div>
            <strong>{log.subject}</strong>
            <small>
              {platform && log.business_name ? `${log.business_name} · ` : ''}
              {label(log.event_type)} · {log.recipient}
            </small>
          </div>
          <div>
            <span className={styles.status}>{label(log.status)}</span>
            {log.last_error_code && <small>Needs attention: {label(log.last_error_code)}</small>}
          </div>
          <small>{new Date(log.created_at).toLocaleString('en-NG')}</small>
          {allowRetry && log.status === 'FAILED' && <RetryEmailButton id={log.id} />}
        </article>
      ))}
    </div>
  );
}
