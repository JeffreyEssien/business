import { WorkspaceNavigation } from '@/components/catalog/workspace-navigation';
import {
  BankAccountForm,
  CheckoutSettingsForm,
  DeliveryOptions,
} from '@/components/commerce/checkout-settings';
import { ButtonLink } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { getCheckoutWorkspace } from '@/modules/commerce/queries';
import styles from '@/components/commerce/order-admin.module.css';

export const metadata = { title: 'Checkout settings' };
export default async function CheckoutSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getCheckoutWorkspace(slug);
  return (
    <main className="tenant-home">
      <WorkspaceNavigation name={data.tenant.name} slug={slug} />
      <PageHeader
        eyebrow="ORDERS"
        title="Checkout settings"
        description="Choose what customers provide, where you deliver, and which bank account they use after placing an order."
        action={
          <ButtonLink href={`/t/${slug}/orders`} variant="secondary">
            Back to orders
          </ButtonLink>
        }
      />
      <div className={styles.settingsStack}>
        <Panel
          title="1. Where customers send payment"
          description="Save this first before turning on bank-transfer checkout."
        >
          <BankAccountForm slug={slug} account={data.bankAccount} />
        </Panel>
        <Panel
          title="2. Delivery and pickup choices"
          description="Customers choose one available option during checkout."
        >
          <DeliveryOptions slug={slug} rates={data.shippingRates} />
        </Panel>
        <Panel
          title="3. Information collected at checkout"
          description="These choices affect the live checkout as soon as you save them."
        >
          <CheckoutSettingsForm slug={slug} settings={data.settings} />
        </Panel>
      </div>
    </main>
  );
}
