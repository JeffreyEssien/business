import { redirect } from 'next/navigation';
import { AuthLayout } from '@/components/auth/auth-layout';
import { PasswordForm } from '@/components/auth/password-form';
import { createClient } from '@/lib/supabase/server';
import { updatePassword } from '@/modules/auth/actions';

export const metadata = { title: 'Choose a new password' };

// Reached only after /auth/reset has verified the emailed link and created a session.
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login/forgot?error=expired');
  return (
    <AuthLayout
      title="Choose a new password."
      description="You will be signed in to your workspace once it is saved."
    >
      <PasswordForm action={updatePassword} submitLabel="Save password & open workspace →" />
    </AuthLayout>
  );
}
