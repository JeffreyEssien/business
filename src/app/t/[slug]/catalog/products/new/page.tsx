import { getCategoryWorkspace } from '@/modules/catalog/queries';
import { ProductForm } from '@/components/catalog/product-form';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { EmptyState } from '@/components/ui/empty-state';
import { ButtonLink } from '@/components/ui/button';

export const metadata = { title: 'New product' };
export default async function NewProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { categories, usageTotal, productLimit } = await getCategoryWorkspace(slug);
  const limitReached = productLimit !== null && usageTotal >= productLimit;
  return (
    <main className="tenant-home">
      <PageHeader
        eyebrow="CATALOG"
        title="Add a product"
        description="Start in draft or make the product visible as soon as it is saved."
      />
      <Panel>
        {limitReached ? (
          <EmptyState
            title="Product limit reached"
            description={`This business currently includes ${productLimit} products. Archive an existing product or ask the platform administrator to review the plan.`}
            action={
              <ButtonLink variant="secondary" href={`/t/${slug}/catalog`}>
                Return to products
              </ButtonLink>
            }
          />
        ) : (
          <ProductForm slug={slug} categories={categories} />
        )}
      </Panel>
    </main>
  );
}
