import type { ActivityEvent } from '@/modules/tenants/types';
export function ActivityList({ events }: { events: ActivityEvent[] }) {
  if (!events.length) return <p>No activity recorded yet.</p>;
  return (
    <ul className="activity-list">
      {events.map((event) => (
        <li key={event.id}>
          <span>{event.action.toLowerCase().replaceAll('_', ' ')}</span>
          <time dateTime={event.created_at}>
            {new Date(event.created_at).toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos' })}
          </time>
        </li>
      ))}
    </ul>
  );
}
