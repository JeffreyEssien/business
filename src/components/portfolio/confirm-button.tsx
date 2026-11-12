'use client';
import { useState } from 'react';
import styles from './builder.module.css';

/**
 * Two-step destructive button: the first press asks "Are you sure?" in place, so a stray
 * tap never deletes anything. The confirming button submits the surrounding form.
 */
export function ConfirmButton({
  label,
  confirmLabel,
  question = 'Are you sure?',
}: {
  label: string;
  confirmLabel: string;
  question?: string;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button
        type="button"
        className={`${styles.smallButton} ${styles.dangerButton}`}
        onClick={() => setAsking(true)}
      >
        {label}
      </button>
    );
  }
  return (
    <span className={styles.confirmGroup} role="group" aria-label={question}>
      <span>{question}</span>
      <button type="submit" className={`${styles.smallButton} ${styles.dangerButton}`} autoFocus>
        {confirmLabel}
      </button>
      <button type="button" className={styles.smallButton} onClick={() => setAsking(false)}>
        Cancel
      </button>
    </span>
  );
}
