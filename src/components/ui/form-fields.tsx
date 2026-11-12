import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from 'react';
import styles from './ui.module.css';

type FieldProps = {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  /** Optional status shown beside the label, e.g. an "Example text" badge. */
  labelAddon?: ReactNode;
};

/** A field owns its label and description IDs, including screen-reader associations. */
function Field({
  name,
  label,
  hint,
  error,
  labelAddon,
  children,
}: FieldProps & { children: ReactNode }) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={name}>
        {label}
        {labelAddon && <> {labelAddon}</>}
      </label>
      {children}
      {hint && (
        <p id={`${name}-hint`} className={styles.help}>
          {hint}
        </p>
      )}
      {error && (
        <p id={`${name}-error`} className={styles.help} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
function descriptionIds(name: string, hint?: string, error?: string) {
  return [hint && `${name}-hint`, error && `${name}-error`].filter(Boolean).join(' ') || undefined;
}
export function TextField({
  name,
  label,
  hint,
  error,
  labelAddon,
  className = '',
  ...props
}: FieldProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'name'>) {
  return (
    <Field name={name} label={label} hint={hint} error={error} labelAddon={labelAddon}>
      <input
        {...props}
        name={name}
        id={name}
        className={`${styles.control} ${className}`}
        aria-describedby={descriptionIds(name, hint, error)}
        aria-invalid={error ? true : undefined}
      />
    </Field>
  );
}
export type SelectOption = { value: string; label: string };
export function SelectField({
  name,
  label,
  hint,
  error,
  labelAddon,
  options,
  className = '',
  ...props
}: FieldProps &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'name' | 'children'> & {
    options: readonly SelectOption[];
  }) {
  return (
    <Field name={name} label={label} hint={hint} error={error} labelAddon={labelAddon}>
      <select
        {...props}
        name={name}
        id={name}
        className={`${styles.control} ${className}`}
        aria-describedby={descriptionIds(name, hint, error)}
        aria-invalid={error ? true : undefined}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function TextAreaField({
  name,
  label,
  hint,
  error,
  labelAddon,
  className = '',
  ...props
}: FieldProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'name'>) {
  return (
    <Field name={name} label={label} hint={hint} error={error} labelAddon={labelAddon}>
      <textarea
        {...props}
        name={name}
        id={name}
        className={`${styles.control} ${styles.textarea} ${className}`}
        aria-describedby={descriptionIds(name, hint, error)}
        aria-invalid={error ? true : undefined}
      />
    </Field>
  );
}
