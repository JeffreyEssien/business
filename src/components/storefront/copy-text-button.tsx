'use client';
import { useState } from 'react';
import styles from './portfolio-parts.module.css';

/** Copies a bio to the clipboard so bookers and journalists can paste it word for word. */
export function CopyTextButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={styles.copyButton}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard access can be refused; the text stays selectable on the page.
        }
      }}
    >
      <span aria-live="polite">{copied ? 'Copied' : `Copy ${label}`}</span>
    </button>
  );
}
