import { WorkspaceNavigation } from '@/components/catalog/workspace-navigation';
import { OrderDetail } from '@/components/commerce/order-detail';
import { ButtonLink } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { getOrderDetail } from '@/modules/commerce/queries';

export const metadata = { title: 'Order details' };
export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const data = await getOrderDetail(slug, id);
  return (
    <main className="tenant-home">
      <WorkspaceNavigation name={data.tenant.name} slug={slug} />
      <PageHeader
        eyebrow="ORDER DETAILS"
        title={data.order.reference}
        description={`Received from ${data.order.customer_name_snapshot} on ${new Intl.DateTimeFormat('en-NG', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(data.order.created_at))}.`}
        action={
          <ButtonLink href={`/t/${slug}/orders`} variant="secondary">
            Back to all orders
          </ButtonLink>
        }
      />
      <OrderDetail
        key={`${data.order.payment_status}-${data.order.fulfillment_status}`}
        slug={slug}
        order={data.order}
        items={data.items}
      />
    </main>
  );
}
