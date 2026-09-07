import Link from 'next/link';
import type { ButtonHTMLAttributes, ComponentProps } from 'react';
import styles from './ui.module.css';

type ButtonVariant = 'primary' | 'secondary';
function buttonClass(variant: ButtonVariant, className = '') {
  return `${styles.button} ${styles[variant]} ${className}`;
}

/** Native button behavior is preserved; forms opt in with type="submit". */
export function Button({
  variant = 'primary',
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />;
}

/** Navigation looks like a button but remains a real link. */
export function ButtonLink({
  variant = 'primary',
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}
