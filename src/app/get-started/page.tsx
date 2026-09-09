import type { Metadata } from 'next';
import { ApplicationWizard } from '@/components/applications/application-wizard';

export const metadata: Metadata = {
  title: 'Get your business online | BusinessCare',
  description: 'Tell BusinessCare about your business and the website you want us to prepare.',
  robots: { index: true, follow: true },
};

export default function GetStartedPage() {
  return <ApplicationWizard />;
}
