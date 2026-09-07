import type { ReactNode } from 'react';
import styles from './ui.module.css';
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className={styles.empty}>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}
