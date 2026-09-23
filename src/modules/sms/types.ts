export const SMS_EVENT_TYPES = [
  'ORDER_RECEIVED',
  'PAYMENT_RECEIVED',
  'ORDER_READY',
  'ORDER_SHIPPED',
  'ORDER_DELIVERED',
] as const;

export type SmsEventType = (typeof SMS_EVENT_TYPES)[number];
export type SmsDeliveryMode = 'disabled' | 'test' | 'live';
export type SmsSenderStatus =
  | 'NOT_REQUESTED'
  | 'PENDING_REVIEW'
  | 'PENDING_PROVIDER'
  | 'APPROVED'
  | 'REJECTED'
  | 'REQUEST_FAILED';

export type SmsSettings = {
  enabled: boolean;
  requested_sender_id: string;
  approved_sender_id: string;
  sender_id_status: SmsSenderStatus;
  sender_company_name: string;
  sender_use_case: string;
  sender_status_message: string;
  order_created_enabled: boolean;
  payment_success_enabled: boolean;
  order_ready_enabled: boolean;
  order_shipped_enabled: boolean;
  order_delivered_enabled: boolean;
  marketing_enabled: boolean;
  sender_requested_at: string | null;
  sender_approved_at: string | null;
  updated_at: string;
};

export type SmsLog = {
  id: string;
  tenant_id?: string;
  business_name?: string;
  event_type: SmsEventType;
  status: string;
  sender_id: string;
  recipient: string;
  segment_count: number;
  provider_cost: number | null;
  attempt_count: number;
  last_error_code: string;
  sent_at: string | null;
  delivered_at: string | null;
  created_at: string;
};

export type SmsSenderRequest = {
  tenant_id: string;
  business_name: string;
  requested_sender_id: string;
  sender_id_status: SmsSenderStatus;
  sender_company_name: string;
  sender_use_case: string;
  sender_status_message: string;
  sender_requested_at: string | null;
  sender_approved_at: string | null;
  updated_at: string;
};

export type SmsNotificationContext = {
  id: string;
  tenantId: string;
  orderId: string;
  eventType: SmsEventType;
  recipientPhone: string;
  senderId: string;
  message: string;
  idempotencyKey: string;
  status: 'SENDING';
  attemptCount: number;
  segmentCount: number;
};

export type SmsSenderSubmission = {
  tenantId: string;
  senderId: string;
  companyName: string;
  useCase: string;
};
