# BusinessCare — Multi-Tenant Commerce SaaS
## Master Product, Architecture, and Execution Specification for Codex

**Status:** Authoritative build specification  
**Audience:** Codex / coding agents / engineers  
**Primary rule:** When implementation details conflict with this document, this document wins unless the product owner explicitly changes the requirement.

---

# 0. AGENT OPERATING CONTRACT — READ BEFORE WRITING CODE

This project is a **multi-tenant commerce SaaS**, not a collection of client websites.

The agent MUST preserve the following invariants throughout the entire build:

1. **One primary codebase.**
   - Do not create a Git branch, repository, or copied application per client.
   - Client differences must be represented as tenant data, configuration, themes, layouts, feature entitlements, content, domains, and credentials.
   - Client-specific code is a last resort and requires an explicit product-owner decision.

2. **Every business is a tenant.**
   - Every tenant-owned data record must be associated with a `tenant_id`.
   - Tenant users must never gain access to another tenant's data.
   - Tenant isolation must be enforced at both application and database levels.

3. **The super admin is the control plane.**
   - The platform owner must be able to create, inspect, configure, suspend, reactivate, and monitor tenants.
   - The platform owner must see platform-wide commerce, billing, notifications, domain, webhook, and operational data.
   - Super-admin access does not eliminate auditability; privileged actions must be logged.

4. **Tenant storefronts are data-driven.**
   - Storefront content, theme, layout, SEO, navigation, images, sections, and business information must come from tenant configuration/data.
   - Do not hard-code business-specific copy into components.

5. **Clients must be able to edit all business-facing website text without changing code.**
   - Homepage headings, descriptions, CTA labels, about text, contact content, banners, section titles, footer text, promotional copy, policy-page content, and SEO fields must be editable through the tenant dashboard.
   - Text must be stored in structured content/config records.

6. **Features are entitlement-driven.**
   - Every plan-controlled feature must be resolved through a feature-entitlement layer.
   - The frontend must hide/disable unavailable features.
   - The backend must independently reject unauthorized feature use.
   - Super admin must be able to override a feature on/off for an individual tenant regardless of plan.

7. **Payments are webhook-first.**
   - Browser redirects/callbacks are not the source of truth for successful payments.
   - Payment state changes must be based on verified provider responses and/or verified webhooks.
   - Payment handling must be idempotent.

8. **Never expose secrets to the browser.**
   - Provider secret keys, webhook secrets, service-role keys, SMTP credentials, and encryption keys stay server-side.
   - Client-provided integration secrets must be encrypted at rest.

9. **No arbitrary tenant JavaScript or raw executable code.**
   - Tenants customize through controlled configuration, components, design tokens, and content blocks.
   - Do not implement arbitrary JS injection, server-side code injection, or untrusted template execution.

10. **Do not over-engineer the MVP.**
    - Build modular boundaries now.
    - Introduce queues, distributed services, and advanced infrastructure only when the relevant phase calls for them.
    - A modular monolith is preferred initially.

11. **Do not silently reinterpret product requirements.**
    - If there are multiple implementation options, choose the simplest option that preserves all architectural invariants.
    - Record consequential technical decisions in `/docs/adr/`.

12. **Every phase must end with tests and acceptance criteria.**
    - Do not start the next major phase while critical tests for the current phase are failing.

---

# 1. PRODUCT VISION

BusinessCare is a SaaS platform that lets a business owner launch and manage a branded commerce website without requiring a separate codebase or custom engineering work.

Each business receives:

- a unique storefront;
- a unique tenant admin experience;
- a platform subdomain and optionally a custom domain;
- its own branding;
- its own editable content;
- its own products, customers, orders, inventory, reports, and settings;
- configurable payment options;
- email and SMS notifications;
- configurable SEO;
- configurable theme and page layout;
- plan-based feature availability;
- business-level user roles.

The platform owner receives:

- a super-admin control plane;
- tenant creation/onboarding;
- global monitoring;
- global order/transaction visibility;
- subscription management;
- pricing-plan management;
- feature-flag and entitlement control;
- domain monitoring;
- notification usage monitoring;
- provider/webhook monitoring;
- system health;
- audit logs;
- support impersonation with safeguards.

The commercial goal is recurring SaaS revenue rather than repeated custom website builds.

---

# 2. CORE MENTAL MODEL

```text
ONE CODEBASE
    |
    v
ONE APPLICATION PLATFORM
    |
    +------------------+-------------------+
    |                  |                   |
    v                  v                   v
TENANT A            TENANT B            TENANT C
Xelle               FreshCuts           John's Cakes
    |                  |                   |
    v                  v                   v
Configuration       Configuration       Configuration
Content             Content             Content
Theme               Theme               Theme
Layout              Layout              Layout
Features            Features            Features
Domain              Domain              Domain
Commerce Data       Commerce Data       Commerce Data
```

Do not multiply code.

Multiply tenant configuration and data.

---

# 3. RECOMMENDED INITIAL STACK

The implementation should remain modular enough to substitute providers later.

## Application

- Next.js + TypeScript
- React
- Tailwind CSS
- Server-side APIs through Next.js route handlers/server actions OR a clearly separated API layer
- Prefer a modular monolith initially

## Database

- PostgreSQL
- Supabase is acceptable as the managed PostgreSQL/Auth/Storage layer
- Row Level Security must protect exposed tenant tables

## Authentication

- Supabase Auth or an equivalent provider
- Application-level roles stored in the application database
- Do not rely solely on provider metadata for authorization

## Storage

- Supabase Storage initially or Cloudflare R2/S3-compatible storage
- Tenant-scoped object paths

## Payments

Abstract behind `PaymentProvider`.

Initial supported modes:

- Paystack
- Bank transfer/manual verification

Future:

- Flutterwave
- platform split/subaccount architecture where commercially/compliantly appropriate

## Email

Abstract behind `EmailProvider`.

Potential implementations:

- Resend
- Brevo
- Amazon SES

Prefer provider APIs over unmanaged raw SMTP when possible, but expose an abstraction that can support SMTP if needed.

## SMS

Abstract behind `SmsProvider`.

Initial Nigerian provider candidate:

- Termii

## Domains

Initial:

- `tenant-slug.businesscare.ng`

Custom domains:

- domain mapping + verification
- Cloudflare for SaaS is a preferred scalable approach, subject to product plan/cost constraints
- never mark a custom domain active until DNS/hostname/certificate validation is complete

## Monitoring

Initial:

- application logs
- structured error capture
- uptime checks
- provider/webhook logs

Later:

- Prometheus
- Grafana
- queue metrics
- distributed tracing

---

# 4. SYSTEM CONTEXT

```text
CUSTOMER
   |
   v
tenant-domain.com
   |
   v
DNS / CDN / TLS
   |
   v
BUSINESSCARE APPLICATION
   |
   +----------------------+
   |                      |
   v                      v
TENANT RESOLVER      AUTHORIZATION
   |                      |
   +----------+-----------+
              |
              v
         APPLICATION
              |
   +----------+----------+-------------------+
   |          |          |                   |
   v          v          v                   v
Commerce   Content    Design/SEO         Notifications
   |          |          |                   |
   +----------+----------+-------------------+
              |
              v
          PostgreSQL
              |
   +----------+----------+-------------------+
   |                     |                   |
   v                     v                   v
Payments              Email/SMS          Storage
```

---

# 5. ACCESS SURFACES

The system has three major user surfaces.

## 5.1 Customer storefront

Example:

- `https://xelle.ng`
- `https://xelle.businesscare.ng`

Capabilities:

- browse products;
- search/filter;
- view product details;
- add to cart;
- checkout;
- make payment;
- receive confirmation;
- optionally create customer account later.

## 5.2 Tenant admin

Preferred canonical admin URL:

- `https://app.businesscare.ng/t/xelle`

Optional branded convenience route:

- `https://xelle.ng/admin`

The branded `/admin` route can redirect into the canonical tenant admin after tenant resolution.

Tenant admin capabilities are controlled by role + feature entitlements.

## 5.3 Super admin

Example:

- `https://admin.businesscare.ng`

Accessible only to platform roles.

---

# 6. TENANT RESOLUTION

Every storefront request must resolve a tenant before business data is loaded.

Potential resolution inputs:

1. exact custom domain;
2. platform subdomain;
3. canonical tenant path in the admin application.

## Domain resolution example

Request:

```text
Host: xelle.ng
```

Lookup:

```sql
select id, slug, status
from tenants
where custom_domain = 'xelle.ng'
   or platform_subdomain = 'xelle';
```

Resolved context:

```text
tenant_id = UUID
tenant_slug = xelle
tenant_status = ACTIVE
```

Do not accept a browser-supplied `tenant_id` as authoritative.

Tenant identity comes from:

- trusted hostname/path resolution;
- authenticated membership;
- server-side authorization.

---

# 7. AUTHENTICATION AND AUTHORIZATION

## 7.1 Roles

Recommended initial roles:

```text
SUPER_ADMIN
PLATFORM_SUPPORT

TENANT_OWNER
TENANT_ADMIN
TENANT_MANAGER
TENANT_STAFF
```

Do not couple roles directly to pricing plans.

Roles answer:

> What is this person allowed to do inside an enabled feature?

Entitlements answer:

> Does this tenant have the feature at all?

These are distinct concerns.

## 7.2 User model

```text
users
------------------------------------------
id                    uuid pk
auth_user_id          uuid unique
name                  text
email                 citext
platform_role         nullable enum
status                enum
last_login_at         timestamptz
created_at            timestamptz
updated_at            timestamptz
```

## 7.3 Tenant memberships

Do not put a single `tenant_id` directly on `users` if future multi-business membership is plausible.

Use:

```text
tenant_memberships
------------------------------------------
id                    uuid pk
tenant_id             uuid fk
user_id               uuid fk
role                   enum
status                 enum
invited_by             uuid nullable
created_at             timestamptz
updated_at             timestamptz

unique (tenant_id, user_id)
```

This supports one owner managing multiple businesses later.

## 7.4 Authorization rule

Every sensitive operation must validate:

1. authenticated user;
2. tenant context;
3. active tenant membership OR platform role;
4. required role/permission;
5. required feature entitlement where relevant;
6. record belongs to tenant.

---

# 8. ROW LEVEL SECURITY

All exposed tenant-owned tables must have RLS enabled.

Examples:

- products
- categories
- customers
- orders
- order_items
- payments
- content_blocks
- pages
- navigation_items
- tenant_theme_settings
- tenant_layout_settings
- seo_settings
- notification_logs where exposed
- media_assets
- staff invitations

RLS should effectively enforce:

```text
authenticated tenant member
AND
row.tenant_id belongs to that member
```

Service-role/database admin credentials must never appear in the browser.

RLS must have tests covering:

- tenant A can access tenant A;
- tenant A cannot access tenant B;
- anonymous customer can read only intended published storefront information;
- unauthenticated users cannot access admin data;
- unauthorized updates/deletes fail.

---

# 9. TENANT MODEL

```text
tenants
------------------------------------------
id                       uuid pk
name                     text
slug                     citext unique
status                   enum
industry_key             text nullable
template_key             text
platform_subdomain       citext unique
custom_domain            citext nullable unique
custom_domain_status     enum
default_currency         text default 'NGN'
timezone                 text default 'Africa/Lagos'
locale                   text default 'en-NG'
logo_asset_id            uuid nullable
favicon_asset_id         uuid nullable
owner_membership_id      uuid nullable
plan_id                  uuid nullable
subscription_status      enum
trial_ends_at            timestamptz nullable
created_at               timestamptz
updated_at               timestamptz
last_active_at           timestamptz
```

Tenant status:

```text
PROVISIONING
TRIAL
ACTIVE
PAST_DUE
SUSPENDED
CANCELLED
ARCHIVED
```

Domain status:

```text
NOT_CONFIGURED
PENDING_VALIDATION
PENDING_DNS
PENDING_TLS
ACTIVE
FAILED
REMOVED
```

---

# 10. TENANT ONBOARDING

## 10.1 Super-admin onboarding

Flow:

```text
Super Admin
   |
   v
Businesses
   |
   v
Create Business
   |
   +--> Business information
   +--> Owner information
   +--> Industry/template
   +--> Initial theme preset
   +--> Initial plan
   +--> Domain/subdomain
   +--> Payment setup mode
   +--> Notification defaults
   |
   v
Provision Tenant
```

Provisioning transaction must create:

1. tenant;
2. default tenant settings;
3. tenant owner user/invitation;
4. tenant membership;
5. theme config;
6. layout config;
7. default content blocks;
8. default navigation;
9. SEO defaults;
10. default feature entitlements from plan;
11. subscription record;
12. platform subdomain;
13. onboarding checklist.

The operation should be transactional where possible.

Do not leave a half-created tenant silently.

## 10.2 Self-service onboarding — later phase

Eventually:

```text
businesscare.ng/signup
```

The system automatically provisions a trial tenant.

Do not make self-service onboarding mandatory for the MVP.

---

# 11. ONBOARDING CHECKLIST

Store tenant onboarding progress:

```text
tenant_onboarding
------------------------------------------
tenant_id
business_profile_completed
logo_uploaded
theme_selected
homepage_configured
products_added
payment_configured
email_configured
domain_configured
seo_configured
store_published
completed_at
```

Tenant dashboard should present a completion checklist.

---

# 12. STORE PUBLISHING MODEL

Support explicit publishing.

A business may edit drafts without immediately changing the live website.

Recommended states:

```text
DRAFT
PUBLISHED
```

For content/layout, either:

- use draft/published JSON snapshots; OR
- version records.

MVP option:

```text
tenant_site_versions
------------------------------------------
id
tenant_id
version_number
status              DRAFT | PUBLISHED | ARCHIVED
configuration_json
published_at
published_by
created_at
```

The stored snapshot can reference content/media records or contain normalized page-builder configuration.

Publishing must be atomic from the customer perspective.

---

# 13. CONTENT MANAGEMENT — NON-NEGOTIABLE

**Clients must be able to edit all meaningful business-facing website text from their dashboard.**

Do not hard-code tenant storefront copy in JSX.

## 13.1 Editable text includes

Homepage:

- announcement bar;
- hero headline;
- hero subheadline;
- hero CTA;
- section headings;
- section descriptions;
- featured-product heading;
- categories heading;
- testimonials heading;
- newsletter heading;
- newsletter description;
- promotional banners.

Business pages:

- About Us;
- Contact introduction;
- delivery information;
- FAQ entries;
- return/refund policy;
- privacy policy text;
- terms text;
- custom informational pages.

Commerce copy:

- optional product-page informational blocks;
- delivery message;
- checkout note;
- bank-transfer instructions;
- post-purchase thank-you message.

Footer:

- short business description;
- address;
- support text;
- copyright text;
- social link labels if needed.

## 13.2 Do not confuse editable content with system UX copy

System-controlled labels such as:

- "Add to cart"
- "Checkout"
- validation errors
- system status labels

may be internationalized centrally.

Business-specific marketing copy must be tenant-editable.

---

# 14. PAGES AND CONTENT BLOCKS

Recommended model:

```text
pages
------------------------------------------
id
tenant_id
page_type
slug
name
status
show_in_navigation
sort_order
created_at
updated_at
```

Examples:

```text
HOME
ABOUT
CONTACT
POLICY
CUSTOM
```

Content blocks:

```text
content_blocks
------------------------------------------
id
tenant_id
page_id
block_key
block_type
variant
sort_order
is_enabled
content_jsonb
settings_jsonb
created_at
updated_at
```

Hero example:

```json
{
  "eyebrow": "New Collection",
  "headline": "Luxury Made Effortless",
  "subheadline": "Designed for every occasion.",
  "primaryCta": {
    "label": "Shop Now",
    "href": "/products"
  },
  "secondaryCta": {
    "label": "Our Story",
    "href": "/about"
  },
  "imageAssetId": "..."
}
```

Testimonials example:

```json
{
  "title": "What customers say",
  "items": [
    {
      "quote": "Excellent service.",
      "name": "Jane"
    }
  ]
}
```

---

# 15. PAGE BUILDER / LAYOUT CUSTOMIZATION

The platform must provide controlled layout customization.

Tenants may:

- enable/disable approved sections;
- reorder sections;
- select approved variants;
- configure section-specific settings;
- edit content;
- choose grid density;
- choose image behavior;
- preview changes.

Tenants may NOT:

- upload arbitrary React components;
- execute arbitrary JavaScript;
- modify server code;
- inject unsanitized executable HTML.

## Component registry

```text
hero:centered
hero:split
hero:image-overlay

products:grid
products:carousel
products:editorial

categories:grid
categories:cards

testimonials:cards
testimonials:slider

newsletter:minimal
newsletter:boxed

gallery:grid
gallery:masonry

content:text-image
content:rich-text
```

Renderer input:

```json
{
  "type": "hero",
  "variant": "split",
  "enabled": true,
  "settings": {},
  "content": {}
}
```

Renderer maps:

```text
hero + split -> HeroSplit component
```

Unknown variants must fail safely.

---

# 16. THEME SYSTEM

Theme customization must use controlled design tokens.

## Tenant theme settings

```text
tenant_theme_settings
------------------------------------------
id
tenant_id
theme_preset_key
primary_color
secondary_color
accent_color
background_color
surface_color
text_color
muted_text_color
heading_font_key
body_font_key
border_radius_scale
button_style
shadow_style
container_width
header_variant
footer_variant
product_card_variant
created_at
updated_at
```

## Design tokens

Components should consume CSS variables such as:

```text
--color-primary
--color-secondary
--color-accent
--color-background
--color-surface
--color-text
--color-muted
--font-heading
--font-body
--radius-sm
--radius-md
--radius-lg
--container-width
--section-spacing
```

Do not scatter tenant hex colors through components.

## Presets

Examples:

- Fashion Luxury
- Fashion Minimal
- Beauty Soft
- Beauty Bold
- Restaurant Dark
- Restaurant Warm
- Professional Clean
- General Store Modern

Presets initialize settings; tenants can edit within allowed limits.

---

# 17. LIVE DESIGN EDITOR

Tenant admin must eventually provide:

```text
Design
  |
  +--> Theme
  +--> Layout
  +--> Homepage
  +--> Header
  +--> Footer
  +--> Navigation
  +--> Pages
  +--> SEO
```

Preferred desktop UI:

```text
LEFT PANEL: settings/content
RIGHT PANEL: live storefront preview
```

Preview must use the same rendering engine as production.

Do not maintain a separate fake preview implementation.

---

# 18. NAVIGATION MANAGEMENT

```text
navigation_items
------------------------------------------
id
tenant_id
location          HEADER | FOOTER
label
link_type         PAGE | URL | CATEGORY | COLLECTION
target
sort_order
is_enabled
created_at
updated_at
```

Tenant can:

- rename navigation labels;
- reorder;
- hide/show;
- link to pages/categories;
- add safe external URLs.

---

# 19. SEO — TENANT EDITABLE

SEO is a first-class product feature.

Every tenant must be able to configure global SEO.

Every relevant page/product/category must support page-specific SEO overrides.

## 19.1 Global SEO settings

```text
tenant_seo_settings
------------------------------------------
id
tenant_id
site_title
title_template
default_meta_description
default_og_asset_id
twitter_handle
robots_index_enabled
robots_follow_enabled
google_site_verification
bing_site_verification
organization_schema_jsonb
created_at
updated_at
```

## 19.2 Page SEO

```text
seo_entries
------------------------------------------
id
tenant_id
entity_type        PAGE | PRODUCT | CATEGORY
entity_id
seo_title
meta_description
canonical_url nullable
og_title nullable
og_description nullable
og_asset_id nullable
twitter_title nullable
twitter_description nullable
robots_index
robots_follow
structured_data_jsonb nullable
created_at
updated_at

unique(tenant_id, entity_type, entity_id)
```

## 19.3 SEO UI

Tenant settings should expose:

- SEO title;
- meta description;
- URL slug;
- canonical URL where advanced access is enabled;
- social share title;
- social share description;
- social share image;
- index/noindex;
- follow/nofollow;
- preview of search result snippet;
- preview of social card.

## 19.4 Automatically generated technical SEO

Platform should generate:

- `<title>`;
- meta description;
- canonical;
- Open Graph tags;
- Twitter card tags;
- sitemap;
- robots.txt behavior;
- product structured data;
- organization/local-business structured data where appropriate;
- breadcrumbs structured data where appropriate.

Validate structured data before publishing where practical.

---

# 20. PRODUCTS

```text
products
------------------------------------------
id
tenant_id
name
slug
description
short_description
sku
price
compare_at_price
currency
stock_quantity
track_inventory
status
primary_image_asset_id
seo_entry_id nullable
created_at
updated_at
published_at
```

Status:

```text
DRAFT
ACTIVE
ARCHIVED
```

Unique:

```text
(tenant_id, slug)
```

---

# 21. PRODUCT MEDIA

```text
product_media
------------------------------------------
id
tenant_id
product_id
asset_id
sort_order
alt_text
created_at
```

Alt text must be editable.

SEO UI should warn when meaningful product images have no alt text.

---

# 22. CATEGORIES

```text
categories
------------------------------------------
id
tenant_id
name
slug
description
image_asset_id nullable
status
sort_order
created_at
updated_at
```

Use mapping table if products can belong to multiple categories:

```text
product_categories
------------------------------------------
tenant_id
product_id
category_id
```

---

# 23. CUSTOMERS

```text
customers
------------------------------------------
id
tenant_id
name
email
phone
marketing_email_consent
marketing_sms_consent
total_orders_cached
total_spent_cached
last_order_at
created_at
updated_at
```

Do not use marketing channels without consent where consent is legally/operationally required.

---

# 24. ADDRESSES

```text
customer_addresses
------------------------------------------
id
tenant_id
customer_id
label
recipient_name
phone
address_line_1
address_line_2
city
state
postal_code
country
is_default
created_at
updated_at
```

Orders must snapshot shipping address rather than relying only on mutable customer records.

---

# 25. ORDERS

```text
orders
------------------------------------------
id
tenant_id
customer_id nullable
reference
currency
subtotal
discount_total
delivery_fee
tax_total
total
payment_status
fulfillment_status
customer_name_snapshot
customer_email_snapshot
customer_phone_snapshot
shipping_address_jsonb
customer_note
internal_note
created_at
updated_at
paid_at nullable
fulfilled_at nullable
```

Payment status:

```text
PENDING
AUTHORIZED
PAID
FAILED
PARTIALLY_REFUNDED
REFUNDED
CANCELLED
```

Fulfillment status:

```text
NEW
PROCESSING
READY
SHIPPED
DELIVERED
CANCELLED
```

---

# 26. ORDER ITEMS

Snapshot commercial values.

```text
order_items
------------------------------------------
id
tenant_id
order_id
product_id nullable
product_name_snapshot
sku_snapshot
unit_price
quantity
line_total
created_at
```

Do not recompute historical order values from current product prices.

---

# 27. PAYMENTS

Separate orders from provider transactions.

```text
payments
------------------------------------------
id
tenant_id
order_id
provider
provider_reference
internal_reference
amount
currency
status
payment_method nullable
provider_fee nullable
platform_fee nullable
raw_metadata_jsonb nullable
initiated_at
paid_at nullable
failed_at nullable
created_at
updated_at
```

Provider status must map into normalized internal statuses.

---

# 28. PAYMENT PROVIDER ABSTRACTION

Define interface conceptually:

```ts
interface PaymentProvider {
  initializePayment(input): Promise<InitializePaymentResult>
  verifyPayment(reference): Promise<PaymentVerificationResult>
  refundPayment(input): Promise<RefundResult>
  verifyWebhook(rawBody, headers): VerifiedWebhookEvent
}
```

Application services depend on the interface, not directly on Paystack.

---

# 29. PAYSTACK IMPLEMENTATION RULES

For Paystack:

- initialize transactions server-side;
- store internal order/payment reference before redirect;
- attach enough metadata to reconcile tenant + order;
- verify webhook signatures;
- process `charge.success` idempotently;
- verify amount, currency, reference, and expected tenant/order before marking paid;
- webhook processing must be safe to run more than once;
- maintain webhook event log;
- never trust only the browser callback.

For BusinessCare's own recurring subscriptions, Paystack subscription/plan APIs are acceptable where supported.

Keep merchant-customer payment architecture separate from BusinessCare's SaaS subscription billing.

---

# 30. BANK TRANSFER MODE

Tenants may configure:

```text
tenant_bank_accounts
------------------------------------------
id
tenant_id
bank_name
account_number_encrypted_or_masked_as_needed
account_name
instructions
is_active
created_at
updated_at
```

Checkout:

- show configured bank account;
- generate order reference;
- permit "I have paid";
- optional proof upload;
- mark payment `AWAITING_VERIFICATION`;
- merchant verifies;
- audit merchant confirmation.

Never automatically mark manual transfer as paid based only on customer button click.

---

# 31. BUSINESSCARE PLATFORM BILLING

This is separate from tenant customer payments.

```text
plans
------------------------------------------
id
name
slug
description
price
currency
billing_interval
is_public
is_active
sort_order
created_at
updated_at
```

```text
subscriptions
------------------------------------------
id
tenant_id
plan_id
provider
provider_customer_code nullable
provider_subscription_code nullable
status
current_period_start
current_period_end
grace_period_ends_at nullable
cancelled_at nullable
created_at
updated_at
```

Status:

```text
TRIAL
ACTIVE
PAST_DUE
GRACE_PERIOD
SUSPENDED
CANCELLED
```

---

# 32. FEATURE ENTITLEMENTS — CRITICAL

Pricing tiers must control capabilities through a centralized entitlement system.

Do not scatter:

```ts
if (plan === "PRO")
```

through the codebase.

Use feature definitions.

## 32.1 Feature catalog

```text
features
------------------------------------------
id
key
name
description
value_type       BOOLEAN | INTEGER | STRING | JSON
default_value_jsonb
category
is_active
created_at
updated_at
```

Feature keys examples:

```text
custom_domain
sms_notifications
email_notifications
advanced_seo
custom_pages
theme_customization
layout_customization
custom_fonts
advanced_analytics
staff_accounts
staff_limit
product_limit
order_export
customer_export
discounts
inventory_tracking
abandoned_cart
custom_email_domain
priority_support
remove_platform_branding
webhooks
api_access
multi_location
scheduled_reports
advanced_audit_logs
```

## 32.2 Plan feature values

```text
plan_features
------------------------------------------
plan_id
feature_id
value_jsonb
created_at
updated_at

unique(plan_id, feature_id)
```

Examples:

```text
Starter:
custom_domain = false
sms_notifications = false
staff_limit = 1
product_limit = 50
advanced_seo = false

Growth:
custom_domain = true
sms_notifications = true
staff_limit = 5
product_limit = 500
advanced_seo = true

Pro:
custom_domain = true
sms_notifications = true
staff_limit = 20
product_limit = null/unlimited
advanced_seo = true
api_access = true
```

## 32.3 Tenant feature overrides

Super admin must be able to override individual tenants.

```text
tenant_feature_overrides
------------------------------------------
id
tenant_id
feature_id
override_value_jsonb
reason
expires_at nullable
created_by
created_at
updated_at

unique(tenant_id, feature_id)
```

Example:

```text
Tenant: Xelle
Plan: Starter

custom_domain plan value = false

Super admin override:
custom_domain = true

Effective value = true
```

## 32.4 Feature resolution order

Always calculate:

```text
TENANT OVERRIDE
      |
      | if present
      v
PLAN FEATURE VALUE
      |
      | if present
      v
FEATURE DEFAULT
```

Optionally add platform emergency kill switch above all:

```text
GLOBAL FEATURE KILL SWITCH
      |
      v
TENANT OVERRIDE
      |
      v
PLAN VALUE
      |
      v
DEFAULT
```

## 32.5 Enforcement

Feature enforcement occurs in three places:

1. UI navigation/component visibility;
2. API/service authorization;
3. usage-limit validation.

Never rely only on hidden buttons.

Example:

```text
Growth tenant can see SMS settings.
Starter tenant cannot see SMS settings.
If Starter tenant manually calls SMS API:
403 FEATURE_NOT_AVAILABLE
```

---

# 33. USAGE LIMITS

Entitlements may be numeric.

Examples:

- max products;
- max staff;
- monthly SMS credits;
- monthly email quota;
- max custom pages;
- storage quota.

Recommended:

```text
tenant_usage_counters
------------------------------------------
tenant_id
feature_key
period_start
period_end
usage_value
updated_at
```

For critical limits, calculate against source-of-truth data where feasible instead of trusting counters alone.

---

# 34. TENANT SETTINGS

Avoid one gigantic settings table.

Group settings by responsibility:

```text
tenant_business_settings
tenant_theme_settings
tenant_layout_settings
tenant_seo_settings
tenant_payment_settings
tenant_email_settings
tenant_sms_settings
tenant_checkout_settings
tenant_shipping_settings
tenant_notification_preferences
```

Use JSONB only where the configuration is genuinely semi-structured.

Do not turn the entire database into unvalidated JSON.

Validate JSON structures with schemas at the application boundary.

---

# 35. BUSINESS PROFILE

Editable:

- business name;
- legal/registered name where applicable;
- description;
- logo;
- favicon;
- phone;
- WhatsApp;
- email;
- address;
- city;
- state;
- country;
- opening hours;
- social links.

Store social links separately or in validated JSON.

---

# 36. MEDIA LIBRARY

Tenants need reusable media assets.

```text
media_assets
------------------------------------------
id
tenant_id
storage_provider
storage_key
public_url_or_resolvable_key
file_name
mime_type
file_size
width nullable
height nullable
alt_text nullable
created_by
created_at
```

Tenant storage path:

```text
tenants/{tenant_id}/...
```

Validate:

- MIME type;
- extension;
- maximum size;
- dimensions where relevant.

Do not trust filenames.

---

# 37. EMAIL SYSTEM

## 37.1 Provider abstraction

```ts
interface EmailProvider {
  send(input): Promise<EmailSendResult>
}
```

## 37.2 Tenant email settings

```text
tenant_email_settings
------------------------------------------
tenant_id
enabled
from_name
from_email
reply_to
custom_domain_status
order_created_enabled
payment_success_enabled
order_shipped_enabled
order_delivered_enabled
marketing_enabled
updated_at
```

Do not accept a tenant `from_email` as active until the provider/domain verification requirements have been met.

## 37.3 Templates

Email templates are platform code/templates populated by tenant branding and content.

Initial templates:

- owner invitation;
- order received;
- payment received;
- order ready;
- order shipped;
- order delivered;
- password reset;
- subscription invoice/receipt;
- subscription payment failed.

Tenant-editable transactional email copy can be introduced carefully, with safe template variables.

---

# 38. SMS SYSTEM

## 38.1 Provider abstraction

```ts
interface SmsProvider {
  send(input): Promise<SmsSendResult>
}
```

## 38.2 Tenant SMS settings

```text
tenant_sms_settings
------------------------------------------
tenant_id
enabled
sender_id
sender_id_status
order_created_enabled
payment_success_enabled
order_ready_enabled
order_shipped_enabled
order_delivered_enabled
marketing_enabled
updated_at
```

Sender IDs may require provider approval. Model status explicitly.

---

# 39. NOTIFICATION ORCHESTRATION

Create a `NotificationService`.

Events:

```text
ORDER_CREATED
PAYMENT_SUCCEEDED
ORDER_READY
ORDER_SHIPPED
ORDER_DELIVERED
SUBSCRIPTION_PAYMENT_FAILED
TENANT_SUSPENDED
```

`NotificationService` decides:

1. what tenant;
2. what event;
3. feature enabled?;
4. tenant setting enabled?;
5. consent rules satisfied?;
6. which channels;
7. template;
8. provider;
9. log result.

---

# 40. NOTIFICATION LOGS

```text
notification_logs
------------------------------------------
id
tenant_id
channel
event_type
recipient_masked
provider
provider_message_id nullable
template_key
status
cost nullable
error_code nullable
error_message nullable
order_id nullable
customer_id nullable
created_at
updated_at
```

Status:

```text
QUEUED
SENDING
SENT
DELIVERED
FAILED
SKIPPED
```

Super admin sees all.

Tenant admin sees only own tenant, subject to role/feature.

---

# 41. DOMAIN MANAGEMENT

## 41.1 Platform subdomains

Every tenant receives:

```text
{slug}.businesscare.ng
```

This must work independently of custom-domain readiness.

## 41.2 Custom-domain lifecycle

```text
Tenant requests domain
      |
      v
Validate syntax / uniqueness
      |
      v
Create provider custom hostname
      |
      v
Show DNS records/instructions
      |
      v
Poll provider / receive provider status
      |
      v
DNS validation
      |
      v
TLS validation
      |
      v
ACTIVE
```

Store:

```text
tenant_domains
------------------------------------------
id
tenant_id
hostname
type                PLATFORM_SUBDOMAIN | CUSTOM
status
provider
provider_hostname_id nullable
validation_data_jsonb nullable
is_primary
last_checked_at
created_at
updated_at
```

Do not route an unverified custom domain to another tenant.

Domain uniqueness is a security boundary.

---

# 42. STORE SUSPENSION

When tenant is suspended:

- admin mutations disabled;
- customer storefront behavior is a business decision;
- default MVP behavior: storefront shows a controlled temporary-unavailable/plan-expired page rather than leaking internal errors;
- data must not be deleted;
- super admin can reactivate.

Plan grace-period logic must be configurable.

---

# 43. SUPER ADMIN — CONTROL PLANE

Route group:

```text
admin.businesscare.ng
```

Sections:

```text
Dashboard

Businesses
  - All
  - Trial
  - Active
  - Past Due
  - Suspended
  - Cancelled

Commerce
  - Orders
  - Payments
  - Transactions
  - Customers
  - Products

Billing
  - Plans
  - Subscriptions
  - Platform Payments
  - Failed Renewals
  - Invoices

Features
  - Feature Catalog
  - Plan Entitlements
  - Tenant Overrides
  - Global Kill Switches

Domains
  - Platform Subdomains
  - Custom Domains
  - Pending Validation
  - Failed Domains

Communications
  - Email Logs
  - SMS Logs
  - Provider Failures
  - Usage

Infrastructure
  - Webhooks
  - Jobs
  - API Errors
  - Health
  - Deployments (read-only integration initially)

Administration
  - Platform Users
  - Audit Logs
  - Platform Settings
```

---

# 44. SUPER ADMIN DASHBOARD METRICS

Separate commercial concepts.

## Platform metrics

- total tenants;
- active tenants;
- trials;
- suspended tenants;
- MRR;
- ARR;
- new subscriptions;
- churn;
- past-due subscriptions.

## Commerce metrics

- total merchant GMV;
- orders;
- payment success rate;
- refunds;
- average order value.

## Operations

- webhook success;
- email delivery;
- SMS send success;
- failed jobs;
- API error rate;
- latency;
- domain health.

GMV is not BusinessCare revenue.

---

# 45. SUPER ADMIN BUSINESS DETAIL

For a tenant show:

- business identity;
- owner;
- domain(s);
- plan;
- subscription state;
- effective features;
- feature overrides;
- storefront URL;
- admin URL;
- GMV;
- orders;
- customers;
- products;
- payment configuration status;
- email status;
- SMS status;
- custom domain status;
- onboarding completion;
- activity timeline;
- audit log;
- provider/webhook failures;
- suspend/reactivate controls;
- safe support impersonation.

---

# 46. SUPER ADMIN IMPERSONATION

Impersonation must:

- require a super-admin/support permission;
- create a short-lived impersonation session;
- display a persistent banner;
- show which platform user initiated it;
- log start/end;
- log mutations while impersonating;
- allow immediate exit;
- never reveal the tenant user's actual password;
- preferably disallow highly destructive actions without explicit elevated confirmation.

Audit event examples:

```text
IMPERSONATION_STARTED
IMPERSONATION_ENDED
IMPERSONATED_PRODUCT_UPDATED
IMPERSONATED_ORDER_STATUS_CHANGED
```

---

# 47. AUDIT LOGGING

```text
audit_logs
------------------------------------------
id
tenant_id nullable
actor_user_id nullable
actor_type
actor_role
action
resource_type
resource_id nullable
old_values_jsonb nullable
new_values_jsonb nullable
metadata_jsonb nullable
ip_address nullable
user_agent nullable
created_at
```

Log:

- tenant creation;
- tenant suspension;
- plan change;
- feature override;
- payment setting changes;
- domain changes;
- user role changes;
- impersonation;
- manual payment verification;
- refund requests;
- important content publishing;
- SEO changes optionally;
- provider credential changes without logging secret values.

Never store secret keys in audit payloads.

---

# 48. WEBHOOKS

```text
webhook_events
------------------------------------------
id
provider
provider_event_id nullable
tenant_id nullable
event_type
payload_jsonb
signature_valid
status
attempts
last_error
received_at
processed_at nullable

unique(provider, provider_event_id) where provider_event_id is not null
```

Processing:

```text
RECEIVE
  |
VERIFY SIGNATURE
  |
PERSIST EVENT
  |
IDEMPOTENCY CHECK
  |
PROCESS
  |
MARK PROCESSED
```

Failed webhooks must be retryable from super admin.

---

# 49. BACKGROUND JOBS

MVP may use database-backed jobs or provider-native background execution.

Model:

```text
jobs
------------------------------------------
id
tenant_id nullable
type
payload_jsonb
status
attempts
max_attempts
scheduled_at
started_at nullable
completed_at nullable
last_error nullable
created_at
updated_at
```

Later migrate to:

- BullMQ/Redis; or
- managed queue.

Do not block checkout on non-critical email/SMS delivery.

---

# 50. OBSERVABILITY

Every server log should include where applicable:

```text
request_id
tenant_id
user_id
route
operation
provider
order_id
payment_id
duration_ms
status
```

Do not log:

- passwords;
- payment card data;
- secret keys;
- access tokens;
- unmasked sensitive credentials.

---

# 51. SECURITY REQUIREMENTS

1. RLS on tenant-exposed tables.
2. Server-side authorization.
3. Secrets server-side only.
4. CSRF protection where framework architecture requires.
5. Rate limiting on authentication, checkout, public forms, webhook abuse paths where appropriate.
6. Safe file validation.
7. Sanitization for rich text.
8. No arbitrary JS.
9. Security headers.
10. Verified webhooks.
11. Idempotent payment writes.
12. Tenant ownership checks on every mutation.
13. Encrypted integration credentials.
14. Audit privileged actions.
15. Mask sensitive customer data in broad super-admin tables.
16. Do not store card PAN/CVV.

---

# 52. RICH TEXT

If allowing rich text:

- use a structured editor format or sanitized HTML;
- maintain a strict allowlist;
- strip scripts, event handlers, iframes unless explicitly supported safely;
- preview using sanitized renderer.

Prefer structured editor JSON over unrestricted HTML.

---

# 53. SEARCH / FILTERING

Tenant admin:

- products;
- orders;
- customers.

Super admin:

- tenants;
- orders;
- payments;
- transactions;
- subscriptions;
- webhook events;
- audit logs.

All platform-wide tables must support pagination.

Do not fetch tens of thousands of rows to filter client-side.

---

# 54. ANALYTICS

MVP tenant metrics:

- revenue;
- orders;
- average order value;
- top products;
- recent orders;
- customer count.

Later:

- conversion;
- product views;
- funnel events;
- returning customers;
- abandoned carts.

Feature-gate advanced analytics.

---

# 55. SEO AND ANALYTICS INTEGRATIONS — LATER

Potential gated features:

- Google Analytics ID;
- Meta Pixel ID;
- Google Search Console verification;
- custom tracking integrations.

Do not allow arbitrary script injection in MVP.

Use explicitly supported integration fields.

---

# 56. CHECKOUT SETTINGS

```text
tenant_checkout_settings
------------------------------------------
tenant_id
guest_checkout_enabled
collect_phone
collect_email
collect_delivery_address
order_notes_enabled
bank_transfer_enabled
paystack_enabled
success_message
created_at
updated_at
```

Features may control which payment methods are configurable.

---

# 57. SHIPPING / DELIVERY

MVP:

```text
shipping_zones
------------------------------------------
id
tenant_id
name
status
created_at
```

```text
shipping_rates
------------------------------------------
id
tenant_id
shipping_zone_id
name
amount
rule_jsonb
status
created_at
updated_at
```

Simplest first rule:

- flat fee per configured region/state;
- optional pickup.

Do not build advanced logistics integrations before core checkout is stable.

---

# 58. DISCOUNTS — FEATURE-GATED

Later or Growth/Pro feature.

```text
discounts
------------------------------------------
id
tenant_id
code
type            PERCENTAGE | FIXED
value
minimum_order_amount nullable
starts_at nullable
ends_at nullable
usage_limit nullable
usage_count
status
created_at
updated_at
```

Backend enforces feature entitlement.

---

# 59. STORE BRANDING

Merchant can configure:

- logo;
- favicon;
- theme;
- color palette;
- fonts from approved library;
- header variant;
- footer variant;
- button style;
- product card variant;
- homepage section arrangement;
- social links;
- announcement bar;
- platform branding based on entitlement.

Feature:

```text
remove_platform_branding
```

Starter may show:

```text
Powered by BusinessCare
```

Higher plan can remove.

---

# 60. CLIENT ADMIN EXPERIENCE

Tenant owner login must feel unique because the dashboard loads tenant identity:

```text
XELLE
Business Administration
```

but the underlying application remains shared.

The route may be:

```text
app.businesscare.ng/t/xelle/dashboard
```

or via:

```text
xelle.ng/admin
```

redirecting into the shared tenant dashboard.

Do not create separate admin deployments.

---

# 61. GITHUB / BRANCHING

Recommended:

```text
main
develop
feature/*
fix/*
```

Do NOT create:

```text
client/xelle
client/freshcuts
client/johnscakes
```

A client is a tenant record, not a Git branch.

---

# 62. REPOSITORY STRUCTURE

Suggested organization:

```text
businesscare/
|
+-- app/
|   +-- (storefront)/
|   +-- (tenant-admin)/
|   +-- (super-admin)/
|   +-- api/
|
+-- components/
|   +-- ui/
|   +-- storefront/
|   +-- admin/
|   +-- super-admin/
|   +-- builder/
|
+-- modules/
|   +-- tenants/
|   +-- auth/
|   +-- catalog/
|   +-- orders/
|   +-- customers/
|   +-- payments/
|   +-- billing/
|   +-- content/
|   +-- themes/
|   +-- seo/
|   +-- domains/
|   +-- notifications/
|   +-- features/
|   +-- audit/
|   +-- jobs/
|
+-- providers/
|   +-- payments/
|   +-- email/
|   +-- sms/
|   +-- domains/
|   +-- storage/
|
+-- db/
|   +-- migrations/
|   +-- seeds/
|   +-- policies/
|   +-- tests/
|
+-- docs/
|   +-- adr/
|   +-- architecture/
|
+-- tests/
```

Organize by domain/module rather than giant global `services/` files.

---

# 63. SERVICE BOUNDARIES

Core application services:

```text
TenantService
TenantProvisioningService
MembershipService
AuthorizationService
FeatureEntitlementService
CatalogService
OrderService
CheckoutService
PaymentService
SubscriptionService
ContentService
ThemeService
SeoService
DomainService
EmailService
SmsService
NotificationService
AuditService
MediaService
```

Each service should have a clear responsibility.

---

# 64. EFFECTIVE FEATURE API

Provide a central API:

```text
getEffectiveFeature(tenantId, featureKey)
getTenantEntitlements(tenantId)
assertFeature(tenantId, featureKey)
assertUsageWithinLimit(tenantId, featureKey, currentUsage)
```

Do not read plan tables directly throughout UI/server code.

One feature-resolution implementation should be authoritative.

---

# 65. FEATURE MANAGEMENT UI

Super admin:

```text
Features
   |
   +--> Catalog
   |
   +--> Plan Matrix
   |
   +--> Tenant Overrides
```

Plan Matrix example:

```text
FEATURE                  STARTER    GROWTH    PRO

Custom Domain              No         Yes       Yes
SMS                         No         Yes       Yes
Advanced SEO                No         Yes       Yes
Custom Pages                2          10        Unlimited
Staff Accounts              1          5         20
Products                    50         500       Unlimited
Remove Branding             No         No        Yes
API Access                  No         No        Yes
```

Super admin should edit these values without code deployment.

---

# 66. TENANT SETTINGS UI AND LOCKED FEATURES

When a feature is unavailable, UX can:

- hide it; or
- show it locked with upgrade explanation.

Example:

```text
Advanced SEO 🔒
Available on Growth and Pro
[View Plans]
```

But API still rejects unauthorized attempts.

---

# 67. PLAN CHANGE BEHAVIOR

Upgrade:

- effective features become available immediately after confirmed subscription state depending on billing policy.

Downgrade:

- do not destroy existing data immediately.
- disable restricted actions.
- preserve existing configuration where possible.

Example:

Pro has 10 staff, downgrades to Starter limit 1.

Do NOT delete 9 users.

Instead:

- require owner to reduce active staff;
- or mark excess members disabled after a grace policy;
- clearly communicate.

This rule applies to products/pages/storage limits as relevant.

---

# 68. CACHING

Tenant resolution and feature entitlements may be cached.

However:

- cache must be invalidated when domain, plan, tenant status, or feature override changes;
- security decisions must not remain stale indefinitely;
- keep cache keys tenant-scoped.

Do not introduce caching until correctness tests exist.

---

# 69. DATA DELETION / CHURN

When a tenant cancels:

- status changes;
- storefront behavior changes;
- data retained for configured retention period;
- custom domain mapping can be removed;
- export may be offered depending on plan/policy;
- permanent deletion should be explicit, auditable, and delayed.

Never immediately cascade-delete a tenant because subscription fails.

---

# 70. PLATFORM CONFIGURATION

Global:

```text
platform_settings
------------------------------------------
key
value_jsonb
updated_by
updated_at
```

Examples:

- default trial length;
- support email;
- default grace period;
- platform branding;
- maintenance mode;
- default currency;
- default SEO fallbacks.

Sensitive credentials should use environment/secrets storage, not generic settings.

---

# 71. FEATURE KILL SWITCHES

For risky integrations:

```text
feature_global_state
------------------------------------------
feature_id
enabled
reason nullable
updated_by
updated_at
```

Example:

If SMS provider is failing badly:

```text
sms_notifications global = false
```

This overrides tenant plan/override until restored.

Do not use this for routine billing logic.

---

# 72. ERROR HANDLING

Use stable domain errors:

```text
TENANT_NOT_FOUND
TENANT_SUSPENDED
FORBIDDEN
FEATURE_NOT_AVAILABLE
USAGE_LIMIT_EXCEEDED
PAYMENT_INITIALIZATION_FAILED
PAYMENT_VERIFICATION_FAILED
DOMAIN_NOT_VERIFIED
INVALID_WEBHOOK_SIGNATURE
PRODUCT_OUT_OF_STOCK
ORDER_NOT_FOUND
```

Do not expose stack traces to end users.

---

# 73. API RESPONSE CONVENTIONS

Prefer consistent API shape:

```json
{
  "success": false,
  "error": {
    "code": "FEATURE_NOT_AVAILABLE",
    "message": "SMS notifications are not enabled for this plan."
  }
}
```

User-safe messages.

Detailed diagnostics go to logs.

---

# 74. TESTING STRATEGY

## Unit tests

- feature resolution;
- price calculation;
- order totals;
- payment status mapping;
- tenant resolution;
- SEO fallback logic.

## Integration tests

- tenant provisioning;
- RLS;
- checkout;
- webhook;
- plan upgrade/downgrade;
- feature override;
- domain states;
- publishing.

## End-to-end

Tenant A:

- logs in;
- creates product;
- edits homepage;
- edits SEO;
- publishes;
- customer sees changes;
- customer checks out;
- payment processed;
- tenant sees order.

Tenant B:

- cannot access Tenant A data.

Super admin:

- sees both;
- overrides feature;
- suspends/re-enables tenant.

---

# 75. MANDATORY MULTI-TENANT SECURITY TEST MATRIX

For every tenant-owned module test:

```text
Tenant A SELECT Tenant A -> ALLOW
Tenant A SELECT Tenant B -> DENY

Tenant A UPDATE Tenant A -> ALLOW if role permits
Tenant A UPDATE Tenant B -> DENY

Tenant A DELETE Tenant B -> DENY

Anonymous storefront read published Tenant A data -> ALLOW only intended fields
Anonymous read Tenant A admin/private data -> DENY
```

This is a release blocker.

---

# 76. PHASED IMPLEMENTATION ROADMAP

Do not attempt the entire product in one giant commit.

## PHASE 0 — Foundation

Deliver:

- repository structure;
- environment configuration;
- database migrations;
- auth;
- tenant model;
- tenant memberships;
- basic RLS;
- basic super-admin role;
- CI.

Acceptance:

- create two tenants;
- create users for both;
- prove cross-tenant access fails.

Do not continue until isolation is demonstrated.

---

## PHASE 1 — Tenant Control Plane

Deliver:

- super-admin authentication;
- business list;
- create tenant;
- tenant detail;
- tenant status;
- owner invitation;
- platform subdomain;
- onboarding status.

Acceptance:

- super admin can onboard Xelle without touching DB manually;
- Xelle owner can log in;
- FreshCuts can be onboarded through same flow;
- no new branch/repository created.

---

## PHASE 2 — Catalog

Deliver:

- categories;
- products;
- media uploads;
- inventory basics;
- tenant product CRUD;
- public product catalog.

Acceptance:

- Xelle products never appear on FreshCuts;
- storefront uses resolved tenant.

---

## PHASE 3 — Theme + Content Engine

Deliver:

- theme presets;
- design tokens;
- homepage content blocks;
- section enable/disable;
- section ordering;
- variants;
- business profile;
- header/footer;
- navigation;
- preview;
- publish.

Acceptance:

- Xelle and FreshCuts can look substantially different with same deployment;
- every business-facing homepage text can be changed from admin;
- no business-specific homepage copy is hard-coded.

---

## PHASE 4 — SEO

Deliver:

- global SEO settings;
- per-page SEO;
- product SEO;
- category SEO;
- sitemap;
- robots;
- canonical handling;
- OG/Twitter tags;
- structured data;
- SEO preview.

Acceptance:

- tenant changes homepage title/description and rendered HTML updates;
- custom domain produces correct canonical;
- tenant A SEO never leaks to tenant B.

---

## PHASE 5 — Orders and Checkout

Deliver:

- cart;
- customer capture;
- address;
- order creation;
- order items;
- inventory validation;
- bank transfer;
- order admin;
- fulfillment statuses.

Acceptance:

- historical prices remain stable;
- manual transfer cannot self-confirm as paid;
- tenant sees only own orders.

---

## PHASE 6 — Paystack

Deliver:

- provider abstraction;
- Paystack initialize;
- callback experience;
- webhook verification;
- transaction verification/reconciliation;
- payment logs;
- idempotency;
- retry UI in super admin.

Acceptance:

- repeated webhook does not duplicate payment/order effects;
- wrong amount/reference cannot mark order paid;
- customer callback alone cannot mark order paid.

---

## PHASE 7 — Email

Deliver:

- provider abstraction;
- branded transactional templates;
- tenant email settings;
- order/payment notifications;
- notification logs.

Acceptance:

- Xelle email contains Xelle branding;
- FreshCuts email contains FreshCuts branding;
- one code path serves both.

---

## PHASE 8 — SMS

Deliver:

- provider abstraction;
- sender ID fields/status;
- transactional SMS;
- logs;
- usage tracking.

Acceptance:

- tenant settings + feature entitlement both required;
- Starter cannot bypass SMS restriction via API.

---

## PHASE 9 — Pricing / Feature Entitlements

Deliver:

- feature catalog;
- plan feature matrix;
- tenant overrides;
- global feature state;
- feature-aware navigation;
- server enforcement;
- usage limits.

Acceptance:

- feature changes in super admin take effect without deploy;
- tenant override beats plan;
- backend rejects unavailable feature use.

---

## PHASE 10 — SaaS Subscription Billing

Deliver:

- platform plans;
- subscriptions;
- recurring billing integration;
- failed renewal handling;
- grace period;
- suspension;
- subscription event logs.

Acceptance:

- merchant customer sales are clearly separate from BusinessCare billing;
- failed SaaS payment follows policy without deleting business data.

---

## PHASE 11 — Custom Domains

Deliver:

- tenant domain UI;
- provider abstraction;
- DNS instructions;
- verification;
- TLS state;
- primary domain;
- canonical URL update;
- domain health super-admin page.

Acceptance:

- unverified domain cannot hijack another tenant;
- tenant always has functioning platform subdomain;
- domain status visible to both tenant and super admin.

---

## PHASE 12 — Super Admin Observability

Deliver:

- platform KPIs;
- tenant GMV;
- MRR;
- orders;
- payment health;
- webhooks;
- email/SMS;
- jobs;
- errors;
- audit;
- impersonation.

Acceptance:

- super admin sees platform-wide state;
- tenant admins do not gain platform-wide access.

---

## PHASE 13 — Hardening

Deliver:

- rate limiting;
- backup/restore procedure;
- data export;
- richer auditing;
- alerting;
- load testing;
- security review;
- performance indexes;
- query analysis;
- retention policies.

---

# 77. DATABASE INDEXES

At minimum evaluate:

```sql
create index on products (tenant_id, status);
create unique index on products (tenant_id, slug);

create index on categories (tenant_id, status);
create unique index on categories (tenant_id, slug);

create index on orders (tenant_id, created_at desc);
create index on orders (tenant_id, payment_status);
create index on orders (tenant_id, fulfillment_status);

create index on customers (tenant_id, created_at desc);
create index on payments (tenant_id, created_at desc);
create index on payments (provider, provider_reference);

create index on content_blocks (tenant_id, page_id, sort_order);
create index on audit_logs (tenant_id, created_at desc);
create index on webhook_events (provider, created_at desc);
```

Measure before adding excessive indexes.

---

# 78. MIGRATIONS

All schema changes must be migrations.

Do not make production-only manual schema edits.

Migrations include:

- tables;
- constraints;
- indexes;
- RLS;
- grants;
- triggers;
- seed feature definitions where needed.

---

# 79. SEED DATA

Development seed should create:

```text
Platform Super Admin

Tenant 1:
Xelle
Fashion Luxury
Growth

Tenant 2:
FreshCuts
Beauty Soft
Starter

Tenant 3:
John's Cakes
Restaurant Dark
Pro
```

Seed distinct products/content/orders so tenant isolation can be visually tested.

---

# 80. DEVELOPMENT ENVIRONMENTS

```text
local
staging
production
```

Never use production payment keys in local/staging.

Provider keys:

```text
PAYSTACK_TEST_*
PAYSTACK_LIVE_*
```

Use environment-specific webhooks.

---

# 81. CI/CD

Pipeline:

```text
checkout
  |
install
  |
lint
  |
typecheck
  |
unit tests
  |
database/RLS tests
  |
build
  |
integration tests where available
  |
deploy staging
  |
smoke tests
  |
production approval/deploy
```

Schema migrations must be coordinated safely.

---

# 82. ARCHITECTURE DECISION RECORDS

Create ADRs for consequential decisions.

Examples:

```text
ADR-001 multi-tenant shared database
ADR-002 tenant resolution
ADR-003 feature entitlement precedence
ADR-004 payment provider abstraction
ADR-005 domain provider strategy
ADR-006 content block structure
ADR-007 RLS policy model
```

An agent must not silently reverse an ADR.

---

# 83. DEFINITION OF DONE FOR ANY FEATURE

A feature is not complete until:

- tenant isolation considered;
- authorization implemented;
- entitlement behavior implemented if relevant;
- audit requirements considered;
- empty/loading/error states implemented;
- validation implemented;
- tests pass;
- super-admin impact considered;
- tenant-admin impact considered;
- docs updated;
- no secrets leaked.

---

# 84. FORBIDDEN SHORTCUTS

Codex MUST NOT:

- create a branch per client;
- create a DB table per tenant;
- copy the entire app per tenant;
- hard-code tenant names or domains in shared components;
- trust `tenant_id` from client payload;
- disable RLS to "fix" access;
- use service-role key in browser;
- mark payments successful only from redirect;
- expose provider secret keys;
- implement plan checks only in UI;
- store raw passwords;
- permit arbitrary tenant JS;
- delete tenant data on failed subscription;
- make custom-domain records active before verification;
- merge tenant and super-admin permissions;
- conflate merchant GMV with BusinessCare revenue.

---

# 85. PRODUCT OWNER GOAL CHECK

Before implementing any large feature, ask internally:

> Does this make BusinessCare more like one scalable platform, or does it make it more like many custom client websites?

Prefer the scalable-platform solution.

Before adding client-specific behavior:

> Can this be expressed as configuration, content, layout, theme, entitlement, or a reusable module?

If yes, do that.

---

# 86. MVP SUCCESS SCENARIO

A successful MVP demonstrates this exact story:

1. Super admin logs into BusinessCare.
2. Creates "Xelle."
3. Selects Fashion template and Growth plan.
4. System creates Xelle tenant and owner.
5. Xelle owner accepts invite and logs in.
6. Xelle owner uploads logo.
7. Xelle owner changes colors/fonts.
8. Xelle owner edits every homepage text section.
9. Xelle owner changes hero layout.
10. Xelle owner adds About page.
11. Xelle owner edits global and homepage SEO.
12. Xelle owner adds products.
13. Xelle storefront is available at `xelle.businesscare.ng`.
14. Customer creates order.
15. Customer pays through configured method.
16. Order/payment appears in Xelle admin.
17. Email/SMS fires if enabled and entitled.
18. Super admin sees transaction globally.
19. Super admin creates FreshCuts.
20. FreshCuts has completely different branding/content/products.
21. Xelle cannot access FreshCuts.
22. FreshCuts cannot access Xelle.
23. Super admin changes Xelle feature override.
24. Feature changes without Git branch or deployment.
25. Xelle later connects a custom domain.
26. System validates it and changes canonical URL.
27. One future product feature is deployed once and becomes available across eligible tenants.

If the architecture cannot support this scenario cleanly, it has drifted from the goal.

---

# 87. FUTURE CAPABILITIES — DO NOT BUILD BEFORE CORE

Possible future modules:

- appointment/service booking;
- restaurant menu ordering;
- WhatsApp automation;
- abandoned cart;
- loyalty;
- coupons;
- multi-location;
- POS;
- invoicing;
- mobile admin app;
- shipping-provider integration;
- tax engines;
- marketplace/vendor support;
- tenant API keys;
- external webhooks;
- AI content assistant;
- AI SEO suggestions;
- multilingual storefront;
- custom app marketplace.

Do not let these derail the core commerce SaaS MVP.

---

# 88. CURRENT EXTERNAL-PROVIDER ASSUMPTIONS TO VERIFY DURING IMPLEMENTATION

Provider APIs change. Before implementing each external integration, check the current official docs.

Architectural assumptions as of this specification:

1. PostgreSQL/Supabase RLS is used as defense-in-depth for tenant data.
2. Paystack supports transaction initialization, webhooks, subscriptions, and split/subaccount models.
3. Paystack webhooks should be preferred over relying on client callbacks for authoritative payment state.
4. Cloudflare for SaaS supports SaaS custom hostnames and requires hostname/certificate validation.
5. External email/SMS providers may require domain/sender verification.

Do not hard-code behavior based on stale provider examples. Isolate providers behind adapters.

---

# 89. REFERENCE ARCHITECTURE

```text
                               INTERNET
                                  |
                                  v
                         DNS / CDN / TLS
                                  |
        +-------------------------+-------------------------+
        |                         |                         |
        v                         v                         v
 xelle.businesscare.ng       xelle.ng              freshcuts.ng
        |                         |                         |
        +-------------------------+-------------------------+
                                  |
                                  v
                         TENANT RESOLVER
                                  |
                                  v
                        tenant_id + domain
                                  |
                                  v
                    BUSINESSCARE APPLICATION
                                  |
     +----------------------------+---------------------------+
     |                            |                           |
     v                            v                           v
 STOREFRONT                 TENANT ADMIN                 SUPER ADMIN
     |                            |                           |
     +----------------------------+---------------------------+
                                  |
                                  v
                       AUTHORIZATION LAYER
                                  |
                                  v
                      FEATURE ENTITLEMENTS
                                  |
                                  v
                  DOMAIN APPLICATION SERVICES
                                  |
     +-------------+--------------+--------------+---------------+
     |             |              |              |               |
     v             v              v              v               v
 Catalog        Orders         Content         SEO            Design
     |             |              |              |               |
     +-------------+--------------+--------------+---------------+
                                  |
                                  v
                             POSTGRESQL
                                  |
                      RLS + tenant_id isolation
                                  |
      +---------------------------+----------------------------+
      |                           |                            |
      v                           v                            v
  PAYMENTS                  NOTIFICATIONS                  STORAGE
      |                     |            |                    |
      v                     v            v                    v
   Paystack               Email         SMS                 Media
```

---

# 90. DATA MODEL RELATIONSHIP SUMMARY

```text
TENANTS
 |
 +-- TENANT_MEMBERSHIPS -- USERS
 |
 +-- TENANT_BUSINESS_SETTINGS
 +-- TENANT_THEME_SETTINGS
 +-- TENANT_LAYOUT_SETTINGS
 +-- TENANT_SEO_SETTINGS
 +-- TENANT_EMAIL_SETTINGS
 +-- TENANT_SMS_SETTINGS
 +-- TENANT_CHECKOUT_SETTINGS
 |
 +-- TENANT_DOMAINS
 |
 +-- PAGES
 |    |
 |    +-- CONTENT_BLOCKS
 |
 +-- NAVIGATION_ITEMS
 |
 +-- MEDIA_ASSETS
 |
 +-- CATEGORIES
 |
 +-- PRODUCTS
 |    |
 |    +-- PRODUCT_MEDIA
 |    +-- PRODUCT_CATEGORIES
 |
 +-- CUSTOMERS
 |    |
 |    +-- CUSTOMER_ADDRESSES
 |
 +-- ORDERS
 |    |
 |    +-- ORDER_ITEMS
 |    +-- PAYMENTS
 |
 +-- SUBSCRIPTIONS
 |
 +-- TENANT_FEATURE_OVERRIDES
 |
 +-- NOTIFICATION_LOGS
 +-- AUDIT_LOGS
 +-- JOBS
 +-- WEBHOOK_EVENTS

PLANS
 |
 +-- PLAN_FEATURES -- FEATURES
```

---

# 91. FINAL INSTRUCTION TO THE CODING AGENT

Build the system incrementally, but always preserve the end-state architecture.

Do not optimize for the fastest demo if the shortcut makes tenant isolation, feature gating, content customization, payments, or future onboarding fundamentally harder.

The product owner wants:

- a SaaS;
- one codebase;
- many businesses;
- deep but controlled customization;
- tenant-owned content;
- tenant-owned SEO;
- configurable themes/layouts;
- independent domains;
- independent commerce data;
- independent admins;
- centralized super-admin visibility;
- pricing tiers;
- per-tenant feature overrides;
- recurring platform billing;
- clean provider abstractions;
- strong tenant isolation.

The desired operational end state is:

```text
NEW CLIENT
   |
   v
CREATE TENANT
   |
   v
ASSIGN PLAN
   |
   v
CREATE OWNER
   |
   v
APPLY TEMPLATE + DEFAULT CONTENT
   |
   v
TENANT EDITS CONTENT / THEME / SEO
   |
   v
ADD PRODUCTS
   |
   v
CONFIGURE PAYMENTS + NOTIFICATIONS
   |
   v
PUBLISH
   |
   v
CONNECT CUSTOM DOMAIN (OPTIONAL)
```

No code duplication is required to onboard a normal client.

That is the architectural goal.

---

# Official documentation references used to validate architecture assumptions

- Supabase documentation: PostgreSQL Row Level Security
- Paystack documentation: Transactions, Webhooks, Subscriptions, Split Payments
- Cloudflare for Platforms documentation: Cloudflare for SaaS and Custom Hostnames

Always re-check current official provider documentation at implementation time.
