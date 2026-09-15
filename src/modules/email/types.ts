export const EMAIL_EVENT_TYPES = [
  'OWNER_INVITATION',
  'ORDER_RECEIVED',
  'PAYMENT_RECEIVED',
  'ORDER_READY',
  'ORDER_SHIPPED',
  'ORDER_DELIVERED',
] as const;
export type EmailEventType = (typeof EMAIL_EVENT_TYPES)[number];

export type EmailDeliveryMode = 'disabled' | 'test' | 'live';

export type EmailSettings = {
  enabled: boolean;
  from_name: string;
  from_email: string;
  reply_to: string;
  custom_domain_status: 'NOT_CONFIGURED' | 'PENDING' | 'VERIFIED' | 'FAILED';
  order_created_enabled: boolean;
  payment_success_enabled: boolean;
  order_ready_enabled: boolean;
  order_shipped_enabled: boolean;
  order_delivered_enabled: boolean;
  marketing_enabled: boolean;
  updated_at: string;
};

export type EmailLog = {
  id: string;
  tenant_id?: string;
  business_name?: string;
  event_type: EmailEventType;
  status: string;
  subject: string;
  recipient: string;
  attempt_count: number;
  last_error_code: string;
  sent_at: string | null;
  delivered_at: string | null;
  created_at: string;
};

export type EmailNotificationContext = {
  id: string;
  tenantId: string;
  orderId: string | null;
  eventType: EmailEventType;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  idempotencyKey: string;
  status: 'SENDING';
  attemptCount: number;
  templateData: {
    businessName: string;
    businessEmail: string;
    storeSlug: string;
    logoUrl: string;
    primaryColor: string;
    backgroundColor: string;
    senderName: string;
    replyTo: string;
    invitationUrl?: string;
  };
  order: null | {
    reference: string;
    subtotal: number;
    deliveryFee: number;
    total: number;
    currency: string;
    deliveryMethod: string;
    deliveryInstructions: string;
    paymentMethod: string;
    createdAt: string;
  };
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
};
