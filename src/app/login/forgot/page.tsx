import Link from 'next/link';
import { AuthLayout } from '@/components/auth/auth-layout';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import styles from '@/components/ui/ui.module.css';

export const metadata = { title: 'Reset your password' };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <AuthLayout
      title="Forgot your password?"
      description="Enter the email you sign in with and we will send you a reset link."
      footer={
        <>
          Remembered it?{' '}
          <Link className={styles.authLink} href="/login">
            Back to sign in
          </Link>
        </>
      }
    >
      <ForgotPasswordForm linkExpired={error === 'expired'} />
    </AuthLayout>
  );
}
