'use client';
import { useState } from 'react';
import { TextField } from './form-fields';
import { Button } from './button';
/** Copying is optional: a read-only, selectable input also works when clipboard access is denied. */
export function CopyField({ name, label, value }: { name: string; label: string; value: string }) {
  const [copiedValue, setCopiedValue] = useState('');
  const [copyFailed, setCopyFailed] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedValue(value);
      setCopyFailed(false);
    } catch {
      setCopyFailed(true);
    }
  }
  return (
    <div className="section-stack">
      <TextField
        name={name}
        label={label}
        value={value}
        readOnly
        onFocus={(event) => event.target.select()}
      />
      <Button variant="secondary" onClick={copy}>
        {copiedValue === value ? 'Copied' : 'Copy link'}
      </Button>
      {copyFailed && <p role="status">Select the link above and copy it manually.</p>}
    </div>
  );
}
