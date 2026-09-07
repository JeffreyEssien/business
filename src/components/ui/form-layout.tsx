import type { FormHTMLAttributes, ReactNode } from 'react';
import styles from './ui.module.css';

export function FormStack({ className = '', ...props }: FormHTMLAttributes<HTMLFormElement>) {
  return <form className={`${styles.form} ${className}`} {...props} />;
}
export function FormGrid({ children }: { children: ReactNode }) {
  return <div className={styles.grid}>{children}</div>;
}
/** Fieldsets group related controls for both visual scanning and assistive technology. */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className={styles.section}>
      <legend className={styles.legend}>{title}</legend>
      <div className={styles.sectionBody}>{children}</div>
      {description && <p className={styles.sectionDescription}>{description}</p>}
    </fieldset>
  );
}
export function FormActions({ note, children }: { note?: string; children: ReactNode }) {
  return (
    <div className={styles.actions}>
      {note && <p className={styles.actionNote}>{note}</p>}
      {children}
    </div>
  );
}
export function FormError({ message }: { message?: string }) {
  return message ? (
    <p className={styles.error} role="alert">
      {message}
    </p>
  ) : null;
}
