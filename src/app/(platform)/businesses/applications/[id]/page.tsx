import { notFound } from 'next/navigation';
import { ApplicationReview } from '@/components/applications/application-review';
import { ButtonLink } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { getApplication } from '@/modules/applications/queries';

export const metadata = { title: 'Review business application' };

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getApplication(id);
  if (!result) notFound();
  return (
    <>
      <PageHeader
        eyebrow={result.application.reference}
        title={result.application.business_name}
        description="Review the customer’s answers carefully. Saved corrections remain separate from the protected original submission."
        action={
          <ButtonLink href="/businesses/applications" variant="secondary">
            Back to applications
          </ButtonLink>
        }
      />
      <ApplicationReview {...result} />
    </>
  );
}
