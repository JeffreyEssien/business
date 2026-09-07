import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PasswordForm } from '@/components/auth/password-form';
import { AuthLayout } from '@/components/auth/auth-layout';
export const metadata = { title: 'Set your password' };
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ invitation?: string }>;
}) {
  const { invitation } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  if (!invitation || !/^[0-9a-f-]{36}$/i.test(invitation)) redirect('/workspace');
  return (
    <AuthLayout
      title="Make yourself at home."
      description="Set a password for your business workspace."
    >
      <PasswordForm id={invitation} />
    </AuthLayout>
  );
}
