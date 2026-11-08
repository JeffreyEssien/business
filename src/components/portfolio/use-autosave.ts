'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { AutosaveResult } from '@/modules/portfolio/actions';

export type AutosaveStatus = { state: 'idle' | 'saving' | 'saved' | 'error'; message?: string };

const pauseMs = 1200;

/**
 * Saves a form a moment after the owner stops typing. Photo files are never sent (they
 * upload on Save); a change made while a save is running is saved right after it.
 */
export function useAutosave(save: (form: FormData) => Promise<AutosaveResult>, enabled = true) {
  const [status, setStatus] = useState<AutosaveStatus>({ state: 'idle' });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const running = useRef(false);
  const queued = useRef<HTMLFormElement | null>(null);

  const run = useCallback(
    async (form: HTMLFormElement) => {
      if (running.current) {
        queued.current = form;
        return;
      }
      running.current = true;
      setStatus({ state: 'saving' });
      const data = new FormData(form);
      for (const [key, value] of [...data.entries()]) {
        if (value instanceof File) data.delete(key);
      }
      try {
        const result = await save(data);
        setStatus(result.ok ? { state: 'saved' } : { state: 'error', message: result.error });
      } catch {
        setStatus({ state: 'error', message: 'Could not save. Check your connection.' });
      } finally {
        running.current = false;
        const next = queued.current;
        queued.current = null;
        if (next) void run(next);
      }
    },
    [save],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onInput = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      if (!enabled) return;
      // Choosing a photo is saved with the Save button, not in the background.
      if (event.target instanceof HTMLInputElement && event.target.type === 'file') return;
      const form = event.currentTarget;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void run(form), pauseMs);
    },
    [enabled, run],
  );

  return { status, onInput };
}

/** Quiet status line for autosave; announced politely to screen readers. */
export function autosaveLabel(status: AutosaveStatus) {
  if (status.state === 'saving') return 'Saving…';
  if (status.state === 'saved') return 'All changes saved';
  if (status.state === 'error') return status.message ?? 'Not saved yet';
  return 'Changes save automatically';
}
