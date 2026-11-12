export type BillingInterval = 'MONTHLY' | 'YEARLY';

export type Plan = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  billing_interval: BillingInterval;
  is_public: boolean;
  sort_order: number;
  is_active: boolean;
};

export type PlanManagementData = { plans: Plan[] };
