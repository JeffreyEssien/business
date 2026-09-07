import Link from 'next/link';
import { EmptyState } from '@/components/ui/empty-state';
import { ButtonLink } from '@/components/ui/button';
import type { Business } from '@/modules/tenants/types';
export function BusinessList({ businesses }: { businesses: Business[] }) {
  if (!businesses.length)
    return (
      <EmptyState
        title="A space for your first business."
        description="Create a business to start its onboarding, or adjust your filters."
        action={<ButtonLink href="/businesses/new">Create business →</ButtonLink>}
      />
    );
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Business</th>
            <th>Status</th>
            <th>Plan</th>
            <th>Template</th>
            <th>
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {businesses.map((b) => (
            <tr key={b.id}>
              <td>
                <div className="business-identity">
                  <span className="business-logo lavender">{b.name.charAt(0).toUpperCase()}</span>
                  <div>
                    <strong>{b.name}</strong>
                    <small>{b.slug} · Store handle</small>
                  </div>
                </div>
              </td>
              <td>
                <span
                  className={`status ${b.status === 'TRIAL' ? 'trial' : b.status === 'ACTIVE' ? 'active' : ''}`}
                >
                  {b.status.toLowerCase().replaceAll('_', ' ')}
                </span>
              </td>
              <td>{b.plans?.name ?? 'Unassigned'}</td>
              <td>{b.template_key}</td>
              <td>
                <Link
                  className="detail-button"
                  aria-label={`View ${b.name}`}
                  href={`/businesses/${b.id}`}
                >
                  ↗
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
