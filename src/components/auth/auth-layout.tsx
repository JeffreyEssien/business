import type { ReactNode } from 'react';
import styles from '@/components/ui/ui.module.css';
/** Shared login, invitation, and account shell; authentication remains in the calling route. */
export function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className={styles.authPage}>
      <section className={styles.authCard}>
        <header className={styles.authHeader}>
          <p className={styles.eyebrow}>BUSINESSCARE WORKSPACE</p>
          <h1 className={styles.title}>{title}</h1>
          {description && <p className={styles.description}>{description}</p>}
        </header>
        {children}
        {footer && <div className={styles.authFooter}>{footer}</div>}
      </section>
    </main>
  );
}
