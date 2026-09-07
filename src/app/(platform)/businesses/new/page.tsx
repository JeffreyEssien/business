import { requirePlatformAdmin } from '@/modules/auth/authorization';
import { CreateBusinessForm } from '@/components/businesses/create-business-form';
import { PageHeader } from '@/components/ui/page-header';
import { ButtonLink } from '@/components/ui/button';
export const metadata = { title: 'Create business' };
export default async function NewBusinessPage() {
  await requirePlatformAdmin();
  return (
    <>
      <PageHeader
        eyebrow="MAKE ROOM FOR A NEW BRAND"
        title="Create a business."
        description="Set up an independent workspace, ready for its owner."
        action={
          <ButtonLink variant="secondary" href="/businesses">
            ← All businesses
          </ButtonLink>
        }
      />
      <CreateBusinessForm />
    </>
  );
}
