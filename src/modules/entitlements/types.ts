export type FeatureValue = boolean | number | string | null | Record<string, unknown>;

export type FeatureDefinition = {
  key: string;
  name: string;
  description: string;
  value_type: 'BOOLEAN' | 'INTEGER' | 'STRING' | 'JSON';
  category: string;
  default_value: FeatureValue;
};

export type EntitlementPlan = { id: string; slug: string; name: string };
export type PlanFeatureValue = { plan_id: string; feature_key: string; value: FeatureValue };
export type FeatureGlobalState = { feature_key: string; enabled: boolean; reason: string | null };
export type TenantFeatureOverride = {
  tenant_id: string;
  feature_key: string;
  value: FeatureValue;
  reason: string;
  expires_at: string | null;
  tenant?: Array<{ name: string }>;
};
export type EntitlementTenant = { id: string; name: string; slug: string };

export type FeatureManagementData = {
  features: FeatureDefinition[];
  plans: EntitlementPlan[];
  planValues: PlanFeatureValue[];
  globalStates: FeatureGlobalState[];
  overrides: TenantFeatureOverride[];
  tenants: EntitlementTenant[];
  businessSearch: string;
};
