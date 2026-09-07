import { LoginForm } from '@/components/auth/login-form';
import { AuthLayout } from '@/components/auth/auth-layout';
import { SignOutForm } from '@/components/auth/sign-out-form';
import { FormError } from '@/components/ui/form-layout';
export const metadata = { title: 'Sign in' };
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invitation?: string }>;
}) {
  const { error, invitation } = await searchParams;
  return (
    <AuthLayout
      title="Welcome back."
      description="Sign in to your business or platform workspace."
      footer="Access is limited to authorized workspace members."
    >
      {error === 'access' && (
        <div className="access-notice">
          <FormError message="This account does not have active platform administrator access." />
          <SignOutForm />
        </div>
      )}
      <LoginForm invitation={invitation} />
    </AuthLayout>
  );
}
