import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { setTemplateActive } from '@/modules/portfolio/template-admin-actions';
import { audienceGroups, type LibraryTemplate } from '@/modules/portfolio/template-library';
import styles from './template-administration.module.css';

export type TemplateAdminRow = { key: string; active: boolean; portfolios: number };

const notices: Record<string, { tone: 'ok' | 'error'; text: string }> = {
  offered: { tone: 'ok', text: 'The template is offered again.' },
  hidden: {
    tone: 'ok',
    text: 'The template is hidden. Portfolios already using it keep their look.',
  },
  last: { tone: 'error', text: 'At least one portfolio template must stay available.' },
  unknown: { tone: 'error', text: 'That template does not exist.' },
  failed: { tone: 'error', text: 'That did not save. Please try again.' },
};

/** Every library template with its status, how many portfolios started from it, and a toggle. */
export function TemplateAdministration({
  templates,
  rows,
  notice,
}: {
  templates: LibraryTemplate[];
  rows: TemplateAdminRow[];
  notice?: string;
}) {
  const status = new Map(rows.map((row) => [row.key, row]));
  const message = notice ? notices[notice] : undefined;
  return (
    <div className={styles.stack}>
      {message && (
        <p className={styles.notice} data-tone={message.tone} role="status">
          {message.text}
        </p>
      )}
      {audienceGroups.map((group) => {
        const groupTemplates = templates.filter((item) => item.audienceGroup === group.value);
        if (groupTemplates.length === 0) return null;
        return (
          <section key={group.value} aria-labelledby={`admin-${group.value}`}>
            <h3 id={`admin-${group.value}`} className={styles.groupTitle}>
              {group.label}
            </h3>
            <ul className={styles.list}>
              {groupTemplates.map((template) => {
                const row = status.get(template.key);
                // A template missing from the database has not been migrated yet.
                const installed = Boolean(row);
                const active = row?.active ?? false;
                return (
                  <li key={template.key} className={styles.row}>
                    <div className={styles.text}>
                      <strong>{template.name}</strong>
                      <span>{template.description}</span>
                      <span className={styles.meta}>
                        {installed
                          ? `${row!.portfolios} ${row!.portfolios === 1 ? 'portfolio' : 'portfolios'} started from it`
                          : 'Not in the database yet: apply the latest migrations.'}
                      </span>
                    </div>
                    <span className={styles.badge} data-active={active}>
                      {active ? 'Offered' : 'Hidden'}
                    </span>
                    <div className={styles.actions}>
                      <Link href={`/templates/${template.key}`} target="_blank">
                        Preview ↗
                      </Link>
                      {installed && (
                        <form action={setTemplateActive.bind(null, template.key, !active)}>
                          <Button type="submit" variant="secondary">
                            {active ? 'Hide' : 'Offer'}
                          </Button>
                        </form>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
