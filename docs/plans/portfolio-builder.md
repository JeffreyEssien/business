# Portfolio builder — implementation plan

Status: **Approved 2026-11-08 — phase 1 implemented** (see ADR 004)
Date: 2026-11-08
Target branch: `develop`

## 1. Goal

Let people launch a personal or studio **portfolio website** on BusinessCare, alongside the existing business stores, without a separate codebase.

Owner decisions captured on 2026-11-08:

| Question         | Decision                                                                                                                                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Who builds it    | A portfolio is a **tenant with a new site kind**. People apply through `/get-started`; Super Admin still reviews and approves before anything is provisioned.                                                        |
| Templates        | A **large template library**, not a single default.                                                                                                                                                                  |
| Layout control   | **Sections + reorder**: choose from a fixed set of section blocks, edit their text/images, add/remove/reorder them, pick a variant per section and a site style. No free-form canvas and no tenant code (spec §0.9). |
| Pricing          | **Free for now**, but every portfolio capability is a real entitlement key the owner can switch on/off globally, per plan, or per tenant from `Plans & features`.                                                    |
| Starter content  | Templates seed **realistic sample content**. A portfolio can't be **published** until every visible sample field and entry is edited or removed; drafts and previews are always allowed.                             |
| Template library | All 12 audiences approved, with **at least two templates each, every one with its own visual style and layout**: 24 at launch. Specified in `docs/plans/portfolio-templates.md`.                                     |
| Contact          | **Email is the main contact** and is required; WhatsApp is an optional extra, never the primary button.                                                                                                              |
| Ease of use      | Built for **non-technical people**: every function stays, but each one is simple to use, with plain words, guided steps, and defaults that hide complexity (`portfolio-templates.md` §5).                            |

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

Starter content adds `portfolio_items.is_sample`, `content_blocks.sample_fields`, and `media_assets.is_sample`; the publish lock is specified in `portfolio-templates.md` §6.

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

The templates add `embed`, `events`, `press`, `bios`, `logos`, `process`, `topics`, `team`, `downloads`, and `project-facts` (see `portfolio-templates.md` §7). `embed` renders only allowlisted providers in sandboxed iframes.

The section manager gains **Add section**, **Remove section**, and **Change layout** alongside the existing move up/down. Reordering keeps using `reorderHomepageSections`, and section types are validated against an allow-list in both `modules/content/validation.ts` and the database. `STORE` tenants can't add portfolio-only sections, and `PORTFOLIO` tenants can't add `products`.

## 5. Template library (launch set: 24)

The full template specification is in **`docs/plans/portfolio-templates.md`**. It covers the research findings, two templates per audience with distinct styles and layouts, the template style layer with self-hosted fonts, the starter content for each template, the ease-of-use rules, and the publish lock.

| Audience           | Templates                                                   |
| ------------------ | ----------------------------------------------------------- |
| Developers         | `developer` Terminal · `developer-product` Product engineer |
| Designers          | `designer` Case study · `designer-bold` Bold canvas         |
| Photographers      | `photographer` Darkroom · `photographer-gallery` White wall |
| Writers            | `writer` Editorial · `writer-notebook` Notebook             |
| Freelancers        | `freelancer` Studio of one · `freelancer-results` Results   |
| Creative studios   | `creative-studio` Agency · `studio-atelier` Atelier         |
| Academics          | `academic` Scholar · `academic-lab` Lab                     |
| Artists            | `artist` Salon · `artist-sketchbook` Sketchbook             |
| Musicians          | `musician` Stage · `musician-epk` Press kit                 |
| Architects         | `architect` Monograph · `architect-material` Material       |
| Job seekers        | `resume` One page · `resume-sidebar` Sidebar CV             |
| Coaches & speakers | `coach-speaker` Keynote · `coach-warm` Warm coach           |

More templates are added later as data-only migrations plus one style block each.

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
2. **Builder** — the `portfolio_items` tables/RPCs, the `/t/[slug]/portfolio` editors, the core sections (about, projects, experience, education, skills, contact-details), add/remove/variant controls, publish snapshotting, the **starter-content model and publish lock**, the **template style layer with self-hosted fonts**, and the four phase-1 templates restyled to their final designs.
3. **Template library + intake** — the remaining 20 templates and their sections, the `/get-started` portfolio branch with a live-preview template gallery, and Super Admin template on/off.
4. **Reach** — project detail pages, SEO entities + sitemap, the contact form + inbox + email notification.

## 9. Decisions log

All five original questions are settled:

1. **Public URL.** Built on `develop` independently of Stage C. Portfolios inherit `{slug}.<domain>` when Stage C lands.
2. **Site kind.** One-way at provisioning (ADR 004).
3. **Plans.** A separate free `portfolio` plan.
4. **Starter content.** Realistic samples, with publishing locked until they are edited or removed (owner, 2026-11-08).
5. **Template set.** All 12 audiences, at least two distinct templates each (owner, 2026-11-08).

**Still open for the owner:** the template specification (`portfolio-templates.md`) is proposed and awaiting approval before phase 2 implements the style layer.
