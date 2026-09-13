import type { SmsLog } from '@/modules/sms/types';
import { RetrySmsButton } from './retry-sms-button';
import styles from './sms.module.css';

function label(value: string) {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^./, (character) => character.toUpperCase());
}

export function SmsLogList({
  logs,
  platform = false,
  allowRetry = false,
}: {
  logs: SmsLog[];
  platform?: boolean;
  allowRetry?: boolean;
}) {
  if (!logs.length)
    return (
      <p>No customer text messages have been queued yet. Enabled order updates will appear here.</p>
    );
  return (
    <div className={styles.logList}>
      {logs.map((log) => (
        <article className={styles.logRow} key={log.id}>
          <div>
            <strong>{label(log.event_type)}</strong>
            <small>
              {platform && log.business_name ? `${log.business_name} · ` : ''}
              From {log.sender_id} · To {log.recipient}
            </small>
          </div>
          <div>
            <span className={styles.status}>{label(log.status)}</span>
            <small>
              {log.segment_count} {log.segment_count === 1 ? 'message part' : 'message parts'}
              {log.provider_cost !== null ? ` · Provider cost ${log.provider_cost}` : ''}
            </small>
            {log.last_error_code && <small>Needs attention: {label(log.last_error_code)}</small>}
          </div>
          <small>{new Date(log.created_at).toLocaleString('en-NG')}</small>
          {allowRetry && log.status === 'FAILED' && <RetrySmsButton id={log.id} />}
        </article>
      ))}
    </div>
  );
}
