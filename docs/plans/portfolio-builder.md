# Portfolio builder — implementation plan

Status: **Approved 2026-11-08 — phase 1 implemented** (see ADR 004)
Date: 2026-11-08
Target branch: `develop`

## 1. Goal

Let people launch a personal or studio **portfolio website** on BusinessCare, alongside the existing business stores, without a separate codebase.

Owner decisions captured on 2026-11-08:

| Question       | Decision                                                                                                                                                                                                             |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Who builds it  | A portfolio is a **tenant with a new site kind**. People apply through `/get-started`; Super Admin still reviews and approves before anything is provisioned.                                                        |
| Templates      | A **large template library**, not a single default.                                                                                                                                                                  |
| Layout control | **Sections + reorder**: choose from a fixed set of section blocks, edit their text/images, add/remove/reorder them, pick a variant per section and a site style. No free-form canvas and no tenant code (spec §0.9). |
| Pricing        | **Free for now**, but every portfolio capability is a real entitlement key the owner can switch on/off globally, per plan, or per tenant from `Plans & features`.                                                    |

## 2. How it fits the existing architecture

Everything below extends what already exists; nothing runs in parallel to it.

| Existing piece                                                                     | Reused for portfolios                                                          |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `tenants`, memberships, invitations, suspension, RLS                               | Unchanged. A portfolio owner is a tenant owner.                                |
| Application wizard → `Approve & create business` provisioner                       | Gains a "What are you building?" branch and a `site_kind` + template argument. |
| `content_blocks` (`block_type`, `variant`, `sort_order`, `is_enabled`, `settings`) | Holds portfolio sections. New block types only; no new section table.          |
| `tenant_site_versions` publish/version flow                                        | Unchanged. A published portfolio is a `configuration` snapshot like a store.   |
| Theme presets + six website styles                                                 | Apply to portfolios as-is; templates choose a default preset + style.          |
| Content pages, navigation, SEO, sitemap/robots                                     | Reused. Portfolio project pages become SEO entities.                           |
| Cloudinary media pipeline and `media_assets`                                       | Reused for photos, project images, and gallery media.                          |
| Feature entitlements (global state → tenant override → plan → default)             | New feature keys; resolved centrally in the database and the UI.               |
| Email queue                                                                        | Delivers portfolio contact-form messages to the owner.                         |

## 3. Data model changes

One new migration per phase; each with rollback-only tests in `supabase/tests/portfolio.sql`.

### 3.1 Site kind

```sql
alter table public.tenants
  add column site_kind text not null default 'STORE'
  check (site_kind in ('STORE','PORTFOLIO'));
```

- Set once by the provisioner. Only Super Admin can change it later, through an audited RPC (and only if the tenant has no orders).
- Every existing tenant stays `STORE`; no data backfill needed.
- `business_applications` gains the same column so the review screen shows what was requested.

### 3.2 Template catalog (database-owned)

```sql
create table public.site_templates (
  key text primary key check (key ~ '^[a-z][a-z0-9-]{1,47}$'),
  site_kind text not null check (site_kind in ('STORE','PORTFOLIO')),
  name text not null,
  description text not null,
  audience text not null,              -- e.g. "Developers & engineers"
  default_preset text not null,        -- existing theme preset key
  default_style text not null,         -- existing website style key
  default_sections jsonb not null,     -- ordered [{type, variant, content}]
  preview_asset_url text,              -- static thumbnail in /public
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Why a table instead of a TypeScript list: the provisioner (a database function) must validate the template and seed its sections in one transaction, and the owner wants to switch templates on/off without a deploy. The database is the single source of truth, and the app reads the active list from it. The four existing store templates (`general`, `fashion`, `beauty`, `restaurant`) are seeded as `STORE` rows so both site kinds use one catalog.

### 3.3 Repeatable portfolio entries

Projects, experience, education, testimonials, and skills are lists with their own fields, ordering, and (for projects) their own pages. They don't fit a single section's `settings` blob.

```sql
create table public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  item_type text not null check (item_type in
    ('PROJECT','EXPERIENCE','EDUCATION','TESTIMONIAL','SKILL','SERVICE','AWARD','PUBLICATION')),
  slug text,                              -- PROJECT only; unique per tenant
  title text not null,
  subtitle text not null default '',      -- role, company, client, issuer
  summary text not null default '',
  body text not null default '',          -- plain text, rendered escaped
  link_url text,                          -- https:// only
  cover_asset_id uuid,
  starts_on date,
  ends_on date,                           -- null = present
  tags text[] not null default '{}',
  sort_order integer not null default 0 check (sort_order >= 0),
  status text not null default 'DRAFT' check (status in ('DRAFT','ACTIVE','ARCHIVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, cover_asset_id) references public.media_assets (tenant_id, id)
);
create unique index portfolio_items_project_slug
  on public.portfolio_items (tenant_id, slug) where item_type = 'PROJECT';
create table public.portfolio_item_media (   -- project galleries
  tenant_id uuid not null,
  item_id uuid not null,
  asset_id uuid not null,
  sort_order integer not null default 0,
  primary key (item_id, asset_id),
  foreign key (tenant_id, item_id) references public.portfolio_items (tenant_id, id) on delete cascade,
  foreign key (tenant_id, asset_id) references public.media_assets (tenant_id, id)
);
```

RLS: tenant members read/write their own rows through authorized RPCs, and Super Admin reads all; there is no direct anonymous access. Published items are copied into the `tenant_site_versions.configuration` snapshot at publish time, so the public site never queries these tables.

### 3.4 Contact messages (phase 4)

`portfolio_contact_messages(tenant_id, name, email_hash, email_encrypted, message, created_at, status)` with per-IP and per-tenant rate limits, the same hashed-email and network controls the application intake uses, and an email-queue notification to the owner. Messages are visible only to that tenant.

### 3.5 Entitlements (all free, all switchable)

| Feature key               | Type    | Default / all plans | Controls                                               |
| ------------------------- | ------- | ------------------- | ------------------------------------------------------ |
| `portfolio_sites`         | BOOLEAN | on                  | Applying for, provisioning, and publishing a portfolio |
| `portfolio_project_pages` | BOOLEAN | on                  | Individual `/projects/{slug}` pages                    |
| `portfolio_contact_form`  | BOOLEAN | on                  | Public contact form and inbox                          |
| `portfolio_gallery`       | BOOLEAN | on                  | Gallery section and multi-image projects               |
| `portfolio_item_limit`    | INTEGER | null (unlimited)    | Non-archived portfolio items                           |

All of these are seeded into `features` and `plan_features` and appear automatically on `/features`, where the existing global pause, plan value, and expiring per-business override controls already work. Each RPC calls the existing `private.assert_feature` / `assert_usage_within_limit` helpers, so turning a feature off is enforced on the server, not just hidden in the UI. Individual templates are switched on/off separately with `site_templates.is_active` (Super Admin screen in phase 3).

## 4. Sections

These are new `content_blocks.block_type` values. Each has 2–3 variants, which the renderer maps to the existing style system.

| Block type      | Variants                           | Content source                |
| --------------- | ---------------------------------- | ----------------------------- |
| `hero` (reused) | centered, split-photo, full-bleed  | block settings                |
| `about`         | text, photo-left, photo-right      | block settings + photo asset  |
| `projects`      | grid, list, featured+grid, masonry | `PROJECT` items               |
| `experience`    | timeline, compact                  | `EXPERIENCE` items            |
| `education`     | timeline, compact                  | `EDUCATION` items             |
| `skills`        | tags, grouped, bars-free list      | `SKILL` items                 |
| `services`      | cards, list                        | `SERVICE` items               |
| `testimonials`  | quotes, carousel-free grid         | `TESTIMONIAL` items           |
| `awards`        | list                               | `AWARD` items                 |
| `publications`  | list                               | `PUBLICATION` items           |
| `gallery`       | grid, masonry                      | media assets                  |
| `stats`         | row                                | block settings (≤4 figures)   |
| `cta`           | banner                             | block settings                |
| `contact`       | form, details-only                 | block settings + contact form |

The section manager gains **Add section**, **Remove section**, and **Change layout** alongside the existing move up/down. Reordering keeps using `reorderHomepageSections`, and section types are validated against an allow-list in both `modules/content/validation.ts` and the database. `STORE` tenants can't add portfolio-only sections, and `PORTFOLIO` tenants can't add `products`.

## 5. Template library (launch set: 12)

Each template is a `site_templates` row: a default section order and variants, a default colour preset, a default website style, and starter placeholder copy written for that audience. Owners can change all of it after provisioning. Picking a template is a starting point, not a lock-in.

| #   | Key               | For                             | Default style       | Section order (abridged)                                             |
| --- | ----------------- | ------------------------------- | ------------------- | -------------------------------------------------------------------- |
| 1   | `developer`       | Developers & engineers          | professional-modern | hero · about · skills · projects · experience · contact              |
| 2   | `designer`        | Product / UI designers          | clean-minimal       | hero(split) · projects(featured) · services · testimonials · contact |
| 3   | `photographer`    | Photographers                   | elegant-luxury      | hero(full-bleed) · gallery(masonry) · about · contact                |
| 4   | `writer`          | Writers & journalists           | elegant-luxury      | hero · about · publications · testimonials · contact                 |
| 5   | `freelancer`      | Freelancers & consultants       | professional-modern | hero · services · projects · stats · testimonials · cta · contact    |
| 6   | `creative-studio` | Small agencies / studios        | bright-bold         | hero(full-bleed) · projects(masonry) · services · stats · contact    |
| 7   | `academic`        | Researchers & lecturers         | clean-minimal       | hero · about · publications · education · awards · contact           |
| 8   | `artist`          | Artists & illustrators          | warm-natural        | hero · gallery · about · awards · contact                            |
| 9   | `musician`        | Musicians & performers          | bright-bold         | hero(full-bleed) · about · projects(list) · gallery · contact        |
| 10  | `architect`       | Architects & interior designers | elegant-luxury      | hero(full-bleed) · projects(grid) · services · about · contact       |
| 11  | `resume`          | Job seekers (one page)          | clean-minimal       | hero · about · experience · education · skills · contact             |
| 12  | `coach-speaker`   | Coaches & speakers              | soft-friendly       | hero · about · services · stats · testimonials · cta · contact       |

With 12 templates × 6 styles × colour presets plus custom colours, that's well over a hundred visibly different starting points. More templates are added later as data-only migrations.

## 6. Routes and screens

| Route                                    | Change                                                                                                                                                                                                                                          |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/get-started`                           | Step 1 asks **Online store** or **Portfolio**. The portfolio path asks for name, headline/profession, template (visual gallery with previews), colours, photo/logo, links, and starter sections. The draft-in-browser behaviour stays the same. |
| `/businesses/applications/[id]`          | Shows site kind + template; editable before approval.                                                                                                                                                                                           |
| `/t/[slug]`                              | Portfolio checklist (photo, about, ≥1 project, contact, publish).                                                                                                                                                                               |
| `/t/[slug]/design`                       | Same editor; the section list switches to portfolio sections with add/remove/layout controls.                                                                                                                                                   |
| `/t/[slug]/portfolio` (new)              | Manage items by tab: Projects, Experience, Education, Skills, Services, Testimonials, Awards, Publications.                                                                                                                                     |
| `/t/[slug]/portfolio/projects/[id]`      | Project editor: cover, gallery, description, link, tags, dates.                                                                                                                                                                                 |
| `/t/[slug]/portfolio/messages` (phase 4) | Contact inbox.                                                                                                                                                                                                                                  |
| `/store/[slug]`                          | The renderer dispatches on `site_kind`. The portfolio homepage is rendered from the published snapshot.                                                                                                                                         |
| `/store/[slug]/projects/[projectSlug]`   | Project detail page (feature-gated), with SEO + structured data (`CreativeWork`).                                                                                                                                                               |
| Commerce routes for portfolio tenants    | Catalog, orders, cart, and checkout return 404 / are hidden from tenant navigation. Commerce RPCs reject `PORTFOLIO` tenants on the server.                                                                                                     |

Tenant navigation (`components/layout/navigation.ts`) gets its menu from `site_kind` + entitlements in one place.

## 7. Security notes (material risks only)

- **XSS:** All portfolio text is plain text rendered as escaped React text, as content pages are today. No rich HTML or markdown-to-HTML in this scope. Links must be `https://` or `mailto:` and are validated on both the client and in SQL.
- **IDOR / cross-tenant media:** The `(tenant_id, asset_id)` composite foreign keys stop a tenant from attaching another tenant's media.
- **Feature bypass:** Every mutating RPC re-checks membership, `site_kind`, and entitlement; hiding something in the UI is never the only check.
- **Contact-form abuse:** Rate limits, the email hash, and length caps; the message body is never logged. A managed challenge (Turnstile) stays deferred, as it is for applications.
- **Résumé/PDF upload:** Not included in v1. Cloudinary `raw` uploads widen the accepted file types and need their own review. v1 offers an external "Download CV" link (https only).

## 8. Delivery phases

Each phase ends with typecheck, build, SQL/RLS tests, the integration suite, and verified desktop/mobile screenshots (per `design.md`). `docs/BUILD_PROGRESS.md` and `CODE_GUIDE.md` are updated per phase.

1. **Foundation** — `site_kind`, `site_templates` (store rows + 4 portfolio templates: developer, designer, photographer, resume), entitlement keys, a provisioner argument, renderer dispatch, and commerce lockout for portfolios. ADR 004.
2. **Builder** — the `portfolio_items` tables/RPCs, the `/t/[slug]/portfolio` editors, the core sections (about, projects, experience, education, skills, contact-details), add/remove/variant controls, and publish snapshotting.
3. **Template library + intake** — the remaining 8 templates and sections (services, testimonials, awards, publications, gallery, stats, cta), the `/get-started` portfolio branch with the template gallery, Super Admin template on/off, and preview thumbnails.
4. **Reach** — project detail pages, SEO entities + sitemap, the contact form + inbox + email notification.

## 9. Open questions

Phase 1 proceeded on the recommended defaults: portfolios build on `develop` (independent of Stage C subdomains), the site kind is one-way, portfolios use a separate free plan, and templates seed guidance copy with no sample entries. Questions 4 and 5 still benefit from an owner answer before phase 3.

1. **Public URL.** The unmerged `feature/stage-c-subdomains` branch already serves `{slug}.<PLATFORM_ROOT_DOMAIN>` by rewriting to `/store/{slug}`, so portfolios get a clean `jane.<domain>` address, and the internal `/store` path never shows. Recommendation: land Stage C first and build portfolios on top of it, with no new public path. Agree?
2. **Site kind switching.** Is a one-way choice at approval acceptable, so a store can't later become a portfolio (or the reverse) without Super Admin?
3. **Plans.** `develop` now has plan pricing (`202609160001_plan_pricing.sql`, `/billing/plans`). Should portfolios use the existing Starter/Growth/Pro plans (all portfolio features on), or get a separate free "Portfolio" plan row so their pricing can diverge from stores later? Recommendation: a separate plan row priced at 0.
4. **Starter copy.** Should templates seed realistic placeholder content (sample projects marked as drafts), or only empty sections with guidance text?
5. **Template set.** Are the 12 templates in §5 the right launch list? Should any be swapped (e.g., fashion model/actor comp card, real-estate agent, chef)?
