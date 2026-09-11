export type PaymentInitialization = {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
};

export type VerifiedPayment = {
  reference: string;
  status: string;
  amountSubunit: number;
  currency: string;
  feeSubunit: number | null;
  paidAt: string | null;
};

export type RefundResult = {
  providerRefundId: string;
  status: string;
  amountSubunit: number;
  currency: string;
};

export type SettlementBank = { code: string; name: string };

export type SettlementAccount = {
  accountNumber: string;
  accountName: string;
};

export type ConnectedSettlement = SettlementAccount & {
  subaccountCode: string;
  bankCode: string;
  bankName: string;
};

export interface PaymentProvider {
  initializePayment(input: {
    reference: string;
    email: string;
    amountSubunit: number;
    currency: string;
    callbackUrl: string;
    subaccountCode: string;
    feeBearer: 'ACCOUNT' | 'SUBACCOUNT';
    metadata: Record<string, string>;
  }): Promise<PaymentInitialization>;
  verifyPayment(reference: string): Promise<VerifiedPayment>;
  refundPayment(input: {
    reference: string;
    amountSubunit: number;
    currency: string;
    customerNote: string;
    merchantNote: string;
  }): Promise<RefundResult>;
  verifyWebhook(rawBody: string, signature: string | null): boolean;
}

export type PaymentOperation = {
  id: string;
  providerReference: string;
  amount: number;
  currency: string;
  status: 'INITIALIZING' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  failureCode: string | null;
  initiatedAt: string;
  tenantName: string;
  orderReference: string;
};

export type WebhookOperation = {
  id: string;
  eventType: string;
  providerReference: string;
  processingStatus: 'PROCESSED' | 'IGNORED' | 'REJECTED';
  errorCode: string | null;
  receivedAt: string;
};
