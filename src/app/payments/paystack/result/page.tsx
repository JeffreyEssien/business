import type { Metadata } from 'next';
import { AuthLayout } from '@/components/auth/auth-layout';
import { ButtonLink } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Payment link unavailable',
  robots: { index: false, follow: false },
};

export default function PaystackUnavailablePage() {
  return (
    <AuthLayout
      title="This payment link is unavailable."
      description="Return to the store and use the order link from your checkout. Your account was not charged by this page."
      footer="Payment status is shown only when a valid order reference and secure customer token are present."
    >
      <ButtonLink href="/">Return to BusinessCare</ButtonLink>
    </AuthLayout>
  );
}
