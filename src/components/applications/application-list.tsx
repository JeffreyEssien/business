import Link from 'next/link';
import { EmptyState } from '@/components/ui/empty-state';
import { ButtonLink } from '@/components/ui/button';
import { applicationStatusLabels, businessTypeOptions } from '@/modules/applications/options';
import type { BusinessApplication } from '@/modules/applications/types';
import styles from './application-admin.module.css';

export function ApplicationList({ applications }: { applications: BusinessApplication[] }) {
  if (!applications.length)
    return (
      <EmptyState
        title="No applications match this view."
        description="New customer applications will appear here after they are submitted."
        action={<ButtonLink href="/get-started">Open customer form →</ButtonLink>}
      />
    );
  return (
    <div className={styles.tableWrap}>
      <table>
        <thead>
          <tr>
            <th>Business</th>
            <th>Applicant</th>
            <th>Business type</th>
            <th>Requested plan</th>
            <th>Status</th>
            <th>Submitted</th>
            <th>
              <span className="sr-only">Review</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {applications.map((application) => (
            <tr key={application.id}>
              <td>
                <strong>{application.business_name}</strong>
                <small className={styles.reference}>{application.reference}</small>
              </td>
              <td>
                <strong>{application.owner_name}</strong>
                <small className={styles.reference}>{application.owner_email}</small>
              </td>
              <td>
                {businessTypeOptions.find((option) => option.value === application.business_type)
                  ?.label ?? application.business_type}
              </td>
              <td className={styles.capitalize}>{application.proposed_plan}</td>
              <td>
                <span className={`${styles.status} ${styles[application.status.toLowerCase()]}`}>
                  {applicationStatusLabels[application.status]}
                </span>
              </td>
              <td>
                {new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium' }).format(
                  new Date(application.submitted_at),
                )}
              </td>
              <td>
                <Link
                  className="detail-button"
                  href={`/businesses/applications/${application.id}`}
                  aria-label={`Review ${application.business_name}`}
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
