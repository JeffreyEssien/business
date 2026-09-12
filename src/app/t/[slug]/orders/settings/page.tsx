import { WorkspaceNavigation } from '@/components/catalog/workspace-navigation';
import {
  BankAccountForm,
  CheckoutSettingsForm,
  DeliveryOptions,
  PaystackSettlementForm,
} from '@/components/commerce/checkout-settings';
import { ButtonLink } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { getCheckoutWorkspace } from '@/modules/commerce/queries';
import { listPaystackBanks } from '@/modules/payments/paystack';
import styles from '@/components/commerce/order-admin.module.css';

export const metadata = { title: 'Checkout settings' };
export default async function CheckoutSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [data, banks] = await Promise.all([
    getCheckoutWorkspace(slug),
    listPaystackBanks().catch(() => []),
  ]);
  return (
    <main className="tenant-home">
      <WorkspaceNavigation name={data.tenant.name} slug={slug} />
      <PageHeader
        eyebrow="ORDERS"
        title="Checkout settings"
        description="Choose how customers pay, where you deliver, and which information checkout collects."
        action={
          <ButtonLink href={`/t/${slug}/orders`} variant="secondary">
            Back to orders
          </ButtonLink>
        }
      />
      <div className={styles.settingsStack}>
        <Panel
          title="1. Payment methods customers can choose"
          description="Turn on the payment choices that should appear during checkout. Set up an account below before enabling its method."
        >
          <CheckoutSettingsForm
            slug={slug}
            settings={data.settings}
            bankAccountReady={Boolean(data.bankAccount)}
          />
        </Panel>
        <Panel
          title="2. Secure online payments"
          description="Connect the bank account where Paystack should settle your online sales."
        >
          <PaystackSettlementForm slug={slug} settings={data.paymentSettings} banks={banks} />
        </Panel>
        <Panel
          title="3. Manual bank transfers"
          description="Save this account before turning on bank-transfer checkout."
        >
          <BankAccountForm slug={slug} account={data.bankAccount} />
        </Panel>
        <Panel
          title="4. Delivery and pickup choices"
          description="Customers choose one available option during checkout."
        >
          <DeliveryOptions slug={slug} rates={data.shippingRates} />
        </Panel>
      </div>
    </main>
  );
}
