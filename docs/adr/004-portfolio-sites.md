# ADR 004: Portfolios as a tenant site kind

Date: 2026-11-08

Status: phases 1 and 2 implemented

## Context

The product owner wants people to build their own portfolio websites on BusinessCare, choosing from a library of templates and arranging sections, free for now but switchable like every other feature. The full plan is in `docs/plans/portfolio-builder.md`.

## Decision

A portfolio is a tenant with `tenants.site_kind = 'PORTFOLIO'` (the default is `STORE`). It reuses tenants, invitations, memberships, RLS, the theme/style system, content blocks, versioned publishing, SEO, and entitlements. There is no second codebase, and no copied application or table set per site type.

- **The site kind is set once.** A trigger rejects later changes. A conversion between kinds needs its own audited operation, because commerce records or portfolio sections would otherwise be stranded.
- **Plans carry a site kind.** A trigger requires a tenant's plan to match its kind. Portfolios sit on a free, non-public `portfolio` plan, so their pricing can diverge from store plans without touching them.
- **Templates live in the database.** `public.site_templates` holds each template's preset, full theme tokens, and ordered homepage sections. The provisioner validates and seeds a template in the same transaction, and a template can be retired with `is_active` without a deployment. The four store templates are catalogued too; store provisioning keeps its existing palette logic unchanged.
- **Provisioning is shared.** `private.provision_tenant_core` holds the tenant row set. `public.provision_tenant` keeps its exact signature and behaviour. `public.provision_portfolio_tenant` adds the template's theme and sections and re-checks `portfolio_sites` through `private.assert_feature`.
- **Boundaries are enforced in the database.** Insert triggers reject commerce rows (products, categories, orders, shipping, bank accounts) for portfolios. A `content_blocks` trigger scopes section types: `products` is store-only, and the portfolio types are portfolio-only. The application hides the same screens and returns 404 for them, but that is a convenience, not the control.
- **Publishing.** A `tenant_site_versions` insert trigger stamps `siteKind` into every snapshot, so the public renderer needs no extra query. For portfolios it also re-checks `portfolio_sites`. `get_public_storefront` exposes `tenant.siteKind`, so commerce routes refuse portfolios before their first publish.
- **Entitlement.** `portfolio_sites` (BOOLEAN, default on, on for every plan) appears on Plans & features. A global pause blocks new portfolios and publishing; already-published portfolios stay online. Later phases add their own keys (project pages, contact form, gallery, item limit) when the features exist, so no switch controls nothing.

## Consequences

- The store design form (`save_site_draft`) writes store-only sections, so it is refused for portfolios. Portfolio section editing arrives in phase 2 with its own RPCs.
- Entry-backed sections (projects, experience, education, skills) are seeded by templates but omitted from the public site until phase 2 gives them entries.
- Public commerce routes on a portfolio render the 404 page. Like every `notFound()` under `/store/[slug]`, the HTTP status is 200 because `loading.tsx` streams first. That is existing behaviour, and fixing it belongs with the store not-found work, not here.

## Phase 2 decisions (2026-11-08)

- **Entries** live in `portfolio_items` (projects, jobs, education, skill groups). Owners write only through `save/delete/reorder_portfolio_item(s)`; RLS grants members read access only. The `portfolio_item_limit` entitlement (unlimited by default) is enforced under a per-tenant advisory lock, like `product_limit`.
- **Page parts** are edited through `save/add/remove_portfolio_section`, which validate fields and layouts per part type. The hero cannot be hidden or removed because it carries the name and main button. Button links accept only `#part`, `https://`, or `mailto:`.
- **Example content is tracked by the database, not the app.** Templates record example values (`sample_content`). Triggers recompute `content_blocks.sample_fields` and `portfolio_items.is_sample` on every write, so a partial edit never clears an example, and direct writes cannot bypass it (members have no write grant).
- **Publish lock.** `tenant_site_versions` refuses a portfolio with `STARTER_CONTENT_PRESENT` while any visible part or entry still holds example values. The error detail lists them, and the app turns that into plain sentences linking to each field. Hidden parts and entries do not count, because visitors never see them. Visible entries are copied into the snapshot as `portfolioItems`.
- **Template styles.** `tokens.templateStyle` (e.g. `pf-terminal`) selects a CSS block per template and self-hosted OFL fonts in `src/fonts` (latin subsets, `next/font/local`, not preloaded). Each page downloads at most two font files, and stores download none.

## Phase 2 completion (2026-11-08)

- **Photos.** `set_portfolio_photo` places, replaces, or removes the opening image, an About photo, or a project cover. Files must sit under the tenant's Cloudinary folder (`businesscare/tenants/{id}/`), be JPG/PNG/WebP, and be at most 5 MB. A replaced file is deleted from Cloudinary only when nothing else uses it **and** the live page no longer shows it. A photo on the live page is kept until the next publish, so visitors never see a broken image. Delivery uses `f_auto,q_auto`, width-limited srcsets, and `g_auto` crops (`src/lib/cloudinary/delivery.ts`).
- **Looks and colours.** `save_portfolio_look` switches style and colours without touching content. Body-text contrast below WCAG AA is refused in SQL (`private.color_contrast`), and the picker uses the same maths (`src/lib/color.ts`).
- **Guided start.** `complete_portfolio_setup` saves look, name, role line, email (required), and WhatsApp (optional) together. `tenant_onboarding.portfolio_setup_completed` ends it, whether completed or skipped.
- **Undo.** Triggers keep the previous state of a portfolio part or entry in `portfolio_revisions` (members read-only). Edits within 30 seconds form one step, and the latest 20 steps are kept. `undo_portfolio_change` restores the last step without recording itself. Photos are not part of undo, because the old file may already be gone.
- **Autosave** sends text and choices about 1.2 s after typing stops, through the same validated RPCs as Save. Photos upload only on Save.
