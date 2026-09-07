'use client';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button, ButtonLink } from '@/components/ui/button';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <AuthLayout
      title="We couldn’t load your workspace."
      description="Please try again. If the problem continues, contact the platform administrator."
    >
      <div className="section-stack">
        <Button onClick={reset}>Try again</Button>
        <ButtonLink href="/login" variant="secondary">
          Return to sign in
        </ButtonLink>
      </div>
    </AuthLayout>
  );
}
