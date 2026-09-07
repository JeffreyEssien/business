import { createClient } from '@/lib/supabase/server';
import { InvitationForm } from '@/components/auth/invitation-form';
import { AuthLayout } from '@/components/auth/auth-layout';
import { SignOutForm } from '@/components/auth/sign-out-form';
import { ButtonLink } from '@/components/ui/button';
export const metadata = { title: 'Business invitation', referrer: 'no-referrer' as const };
export default async function InvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; token_hash?: string }>;
}) {
  const { id, token_hash } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return (
      <AuthLayout
        title="Invalid invitation."
        description="Ask the platform administrator for a new link."
      />
    );
  }
  return (
    <AuthLayout
      title="Your business awaits."
      description="Accept this invitation using the email address named by the platform administrator."
      footer={
        user && (
          <>
            <p>Signed in as {user.email}</p>
            <SignOutForm />
          </>
        )
      }
    >
      {token_hash || user ? (
        <InvitationForm id={id} token={token_hash} />
      ) : (
        <ButtonLink href={`/login?invitation=${id}`}>Sign in to accept →</ButtonLink>
      )}
    </AuthLayout>
  );
}
