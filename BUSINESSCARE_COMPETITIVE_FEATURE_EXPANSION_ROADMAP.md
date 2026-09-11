# BusinessCare Competitive Feature Expansion Roadmap

## Purpose
Preserve and prioritize major capabilities seen across mature commerce platforms such as Shopify, Bumpa, and Selar that BusinessCare does not yet fully provide. The emphasis is on features that can be implemented primarily with BusinessCare's own application logic, database, storefront, and existing infrastructure, without introducing a new paid external provider for each use.

> This is a product backlog and strategic roadmap, not an instruction to implement every feature immediately. Every feature must preserve tenant isolation, entitlement-driven access, server-side authorization, bounded database access, auditability where relevant, tests, and a non-technical merchant UX.

## Strategic goal
BusinessCare should not try to beat established competitors by copying every checkbox. The goal is to close the most important commerce and business-operations gaps while preserving our differentiation: assisted onboarding, easy management for non-technical merchants, African SME fit, strong branding, and one centrally managed multi-tenant platform.

## Priority areas
1. Commerce depth - variants, discounts, bundles, options, reviews, search/filtering, gift cards, returns.
2. Merchant operations - invoices, receipts, offline/manual sales, bulk import/export, expenses, inventory history.
3. Customer intelligence - customer profiles, order history, segments, tags, lifetime value, loyalty.
4. Growth - abandoned carts, upsells, cross-sells, referrals, affiliates, scheduled promotions.
5. Analytics - revenue, profit, products, customers, inventory, conversion funnel, downloadable reports.
6. Business expansion - staff permissions, multiple locations, blogs, digital products, services, memberships.

## Commerce depth

### Discounts and promotions
- Discount codes
- Percentage discounts
- Fixed-amount discounts
- Automatic discounts
- Minimum order rules
- Maximum discount amount
- Product/category-specific discounts
- First-order discounts
- Customer-segment discounts
- Usage limits per code/customer
- Start and expiry dates
- Free-shipping promotions
- Buy X Get Y
- Quantity discounts
- Scheduled sales
- Sale countdown presentation

Discount calculation must be authoritative on the server/database quote path. The browser may preview discounts, but checkout must independently recompute eligibility and totals.

### Product variants and options
- Product option definitions
- Variant combinations
- Variant-specific SKU
- Variant-specific stock
- Variant-specific price/compare-at price
- Variant-specific media
- Default variant
- Out-of-stock handling
- Option ordering
- Variant-level cart and order snapshots

### Add-ons, bundles, cross-sells
- Optional add-ons
- Required customization choices where safe
- Product bundles
- Frequently bought together
- Related products
- Cart upsells
- Checkout upsells
- Rule-based recommendations

### Product reviews and ratings
- Star ratings
- Written reviews
- Verified-purchase indicators
- Moderation
- Merchant replies
- Average rating and count
- Abuse controls

### Search, filtering, sorting
- Storefront search
- Category filters
- Price filters
- Availability filters
- Variant filters
- Sorting by newest, price, popularity
- Search analytics later
- Bounded server-side queries

### Gift cards and store credit
- Merchant-issued gift cards
- Unique codes
- Initial and remaining balance
- Partial redemption
- Expiry policy
- Store credit
- Audited ledger/history

### Returns, refunds, exchanges
- Return lifecycle
- Approval/rejection
- Return reason
- Returned quantity
- Inventory restoration
- Refund status
- Exchange workflow
- Store credit alternative
- Audit history

## Merchant operations

### Bulk product import/export/editing
- CSV template
- CSV/XLSX-compatible import where practical
- Validation preview
- Row-level errors
- Duplicate detection
- Dry-run mode
- Bulk creation
- Bulk price/category/stock changes
- Bulk archive/activate
- Product export
- Import job history

Large imports should eventually run as background jobs.

### Invoices and receipts
- Branded invoice
- Printable receipt
- PDF
- Invoice/reference number
- Customer details
- Line items
- Totals and statuses
- Logo/contact info
- Historical snapshots

### Offline/manual sales
- Manual sale/order
- Select/create customer
- Products/quantities
- Cash/bank transfer/POS/other method
- Inventory decrement
- Receipt
- Analytics inclusion
- Customer history inclusion
- Audit

### Expenses and basic profit
- Expense records/categories
- Amount/date/description
- Optional receipt
- Cost of goods
- Gross profit estimates
- Revenue vs expense summary
- Period filters
- Downloadable reports

### Inventory operations
- Low-stock warnings
- Reorder threshold
- Inventory value
- Adjustment history
- Reason codes
- Stock-in/out
- Bulk adjustment
- Export
- Later stock transfers

## Customer intelligence and CRM

### Customer profiles
- Profile
- Order history
- Addresses
- Total orders/spend
- AOV
- Last purchase
- Notes
- Tags
- Consent flags

### Segmentation
- New/repeat/VIP/inactive
- Product/category purchasers
- Spend-based segments
- Location segments
- Merchant tags

### Customer accounts
- Login
- Order history
- Addresses
- Wishlist
- Store credit/gift cards
- Loyalty
- Returns

### Loyalty
- Points
- Rules
- Balance
- Ledger
- Rewards
- Tiers later
- Expiry later
- Plan gating

## Growth and conversion

### Abandoned cart / checkout
- Persist eligible state
- Detect abandonment
- Merchant dashboard
- Potential revenue
- Recovery link
- Restore cart
- Later automated email/SMS/WhatsApp

### Upsells and cross-sells
- Related products
- Frequently bought together
- Cart upsells
- Post-purchase later
- Merchant-curated relationships
- Automatic rules

### Referrals
- Referral codes/links
- Attribution
- Rewards
- Dashboard
- Fraud controls

### Affiliates
- Affiliate approval
- Referral links
- Attribution window
- Commission rules
- Order attribution
- Commission states
- Affiliate dashboard
- Merchant dashboard
- Manual payout records initially

## Analytics and reporting

### Core metrics
- Revenue
- Paid orders
- Total orders
- AOV
- Top products/categories
- New/returning customers
- Refunds
- Discount usage
- Delivery metrics
- Gross profit where possible

### Customer analytics
- CLV
- Repeat rate
- Acquisition trend
- High-value/inactive customers
- Orders per customer

### Inventory analytics
- Best/slow sellers
- Stock turnover
- Low stock
- Inventory value
- Unsold stocked products

### First-party funnel
- Store visit
- Product view
- Add to cart
- Checkout started
- Payment attempt
- Paid order
- Conversion rate

At scale, analytics may need a separate event/warehouse path.

### Reports
- Order CSV
- Customer CSV
- Product/inventory CSV
- PDF management summary
- Date ranges
- Scheduled reports later

## Content and marketing

### Blog
Reuse existing publishing/SEO/media/content architecture.
- Draft/published posts
- Featured image
- Categories/tags
- Author
- SEO/social
- Sitemap
- Public routes

### FAQ
- FAQ groups
- Questions/answers
- Ordering
- Enable/disable
- Storefront display
- Structured data where valid

### Landing pages/promotions
- Reusable sections
- Campaign pages
- Scheduled banners
- Announcement scheduling
- Promotion start/end
- No arbitrary tenant JS

### Newsletter/leads
- Signup blocks
- Lead database
- Consent
- Source
- CSV export
- Later email-provider sync

## Staff and locations

### Staff accounts and permissions
- Staff invitations
- Owner/Admin/Manager/Staff
- Module permissions
- Product/order/customer/content/financial permissions
- Audit
- Plan-based limits

### Multiple locations
- Locations
- Location inventory
- Fulfillment location
- Pickup points
- Transfers
- Location reports
- Later location staff permissions

## Creator/digital expansion

### Digital products
- Physical/Digital/Service types
- Secure files
- Download entitlement after payment
- Signed links
- Limits
- Download history
- Revocation/refunds

### Services/bookings
- Service products
- Duration
- Availability
- Booking requests
- Capacity
- Status
- Later reminders/calendar

### Tickets
- Ticket product
- Capacity
- Unique ticket
- QR/scannable code
- Check-in
- Attendee export

### Memberships/subscriptions
- Membership product
- Access period
- Recurring customer billing
- Entitlement state
- Member-only features later

Keep merchant-customer subscriptions separate from BusinessCare SaaS billing.

## Features that are not truly free
- SMS: provider charges
- Large-scale email: provider charges
- WhatsApp Business automation: Meta/provider charges
- Online payments: transaction fees
- Shipping integrations: provider/logistics costs
- Custom domains: registration/DNS/platform costs
- AI: inference/API cost
- Large file/course delivery: storage/egress/CDN
- POS terminals: hardware/provider costs
- International FX/payments: provider costs

## Recommended implementation order

### Tier 1
- Product variants/options
- Discounts/coupons
- Bulk import/export
- Invoices/receipts
- Offline/manual sales
- Customer CRM/history
- Core analytics
- Abandoned carts
- Product reviews
- Staff roles/accounts

### Tier 2
- Bundles/upsells
- Gift cards/store credit
- Returns/refunds
- Segmentation
- Loyalty
- Referrals
- Inventory history
- Blog/landing pages

### Tier 3
- Affiliates
- Digital products
- Services/bookings
- Event tickets
- Multiple locations
- Membership/subscription products
- Advanced analytics

## Architectural requirements
- Tenant-scope every tenant-owned row.
- Preserve RLS and server authorization.
- Never trust browser-supplied tenant IDs, totals, prices, permissions, or eligibility.
- Resolve plan features through the entitlement system.
- Enforce usage limits server-side.
- Paginate/bound high-volume queries.
- Make important background work durable and retryable.
- Make payment-affecting operations idempotent.
- Audit sensitive mutations.
- Implement loading/error/degraded states.
- Do not let optional provider failures unnecessarily break core transactions.
- No arbitrary tenant JavaScript.
- Add cross-tenant and acceptance tests.

## Commercial packaging opportunity
Illustrative:
- Starter: core website, catalog, checkout, basic reports, core customer/order management.
- Growth: variants, discounts, reviews, bulk import, staff, richer analytics, abandoned carts, loyalty/referrals.
- Pro: advanced analytics, affiliates, automation, larger limits, advanced permissions, API/webhooks, multi-location.

## Product principle
**A non-technical business should be able to launch, sell, operate, understand, and grow online from one simple BusinessCare system.**

BusinessCare should become a business operating layer for African SMEs, not merely a cheaper clone of an existing storefront platform.

## Verification note
Competitor capabilities and pricing change. Verify current official competitor documentation before implementing a feature solely because a competitor offers it.
