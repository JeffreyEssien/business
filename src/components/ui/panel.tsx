import type { ReactNode } from 'react';
import styles from './ui.module.css';
export function Panel({
  children,
  title,
  description,
  action,
  className = '',
  padded = true,
}: {
  children: ReactNode;
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={`${styles.panel} ${className}`}>
      {title && (
        <div className={styles.panelHeader}>
          <div>
            <h2>{title}</h2>
            {description && <p className={styles.panelDescription}>{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={padded ? styles.panelBody : undefined}>{children}</div>
    </section>
  );
}
