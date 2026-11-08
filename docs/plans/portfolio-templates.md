# Portfolio templates and starter content — specification

Status: **Proposed — awaiting product-owner approval**
Date: 2026-11-08
Parent plan: `docs/plans/portfolio-builder.md` · Decision record: `docs/adr/004-portfolio-sites.md`

## 1. Owner decisions (2026-11-08)

1. **Starter content.** Every template ships with realistic sample content. A portfolio **cannot be published** while any visible sample content remains: each sample field must be edited or removed first. Saving drafts and previewing are always allowed.
2. **Template library.** All 12 audiences are approved. Each audience gets **at least two templates**, and every template has **its own visual style and layout**, not a recolour of another. That makes 24 templates at launch.

## 2. What the research says

The findings below drive every template choice. Sources are listed in §8.

### 2.1 Rules every template follows

| Rule                                                                     | Why                                                                                                                                                                                     | How the templates apply it                                                                                                                                          |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Say who you are and what you do, plainly, in the first screen            | Recruiters first look for a clear professional identity, best project, and the visitor's next step [1].                                                                                 | Every hero opens with name + plain role headline (no clever slogans) + one primary button.                                                                          |
| Lead with the strongest work, and show less of it                        | Hiring managers want 2–3 strong case studies [2]; freelancers convert best with 5–7 curated projects [3]; writers should feature their best ~3 recent clips rather than everything [4]. | Project sections default to 3 featured items and a "see all" link; starter content seeds 2–3 samples, never 10.                                                     |
| State the visitor's own role and the outcome                             | Recruiters and clients look for your personal contribution and real results [1][3].                                                                                                     | Project/case-study entries have **Role** and **Outcome** fields; outcome is optional so nobody invents metrics.                                                     |
| Navigation uses familiar labels; decoration never competes with the work | Plain labels (Work, About, Experience, Contact) and hierarchy over decoration [1]; busy layouts and disruptive animation hurt UX portfolios [2].                                        | Menu labels are fixed plain words. Motion is limited to fades/reveals and is switched off under `prefers-reduced-motion`.                                           |
| Mobile first                                                             | 68% of human web requests in Nigeria come from mobile devices (Cloudflare Radar, Q3 2026) [5].                                                                                          | Every template is designed at 390px first; layouts that only work on desktop (horizontal scroll galleries, hover-only reveals) are excluded.                        |
| WhatsApp is a first-class contact                                        | WhatsApp is installed on 95% of Nigerian smartphones surveyed (Orange/KPMG 2025) [6].                                                                                                   | Contact sections put WhatsApp beside email; the floating "Message me" button is a template option for freelancer, coach, studio, and musician styles.               |
| Light pages                                                              | In Q1 2026 Nigerians spent nearly a fifth of poverty-line income on mobile data (NCC data via BusinessDay) [7].                                                                         | Images go through Cloudinary transformations (responsive `srcset`, WebP/AVIF, lazy below the fold); at most two self-hosted font files per page; no autoplay video. |
| Accessible                                                               | WCAG 2.2 AA is the product baseline (`design.md`).                                                                                                                                      | Each template's palette is validated for 4.5:1 body-text contrast at seed time; focus styles are visible on every style; no information carried by colour alone.    |

### 2.2 What each audience's visitors need

| Audience                        | Who visits and what they want                                                                                                                                   | Must-have sections                                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Developers                      | Recruiters and engineering leads skimming for role, stack, and shipped work [1]                                                                                 | Role headline, skills, 2–3 projects with role, stack, repo/live links, experience, CV link                 |
| Designers                       | Hiring managers reading case studies told as **problem → approach → process → result**, with process visuals before the final design [2]                        | Featured case studies with that structure, about/how-I-work, contact                                       |
| Photographers                   | Clients judging the images; grids fit mixed orientations, a lightbox gives the detail view, and auto-playing slideshows engage poorly [8]                       | Full-bleed hero image, gallery (masonry or justified), series, about, booking                              |
| Writers                         | Editors and clients scanning recent clips by topic and format [4]                                                                                               | Clips grouped by topic/format with outlet and link, short bio, testimonials, contact                       |
| Freelancers & consultants       | Prospective clients asking "can you solve my problem, and how do I start?" [3]                                                                                  | Positioning line, services framed as client problems, case studies, specific testimonials, obvious contact |
| Creative studios                | Brands assessing range and credibility                                                                                                                          | Full-bleed work grid, services, client logos, team, contact                                                |
| Academics                       | Peers, students, and committees; light background, dark text, 2–3 colours, 1–2 fonts, linked publications [9]                                                   | Profile, research interests, publications with links, teaching, awards, talks, contact                     |
| Artists & illustrators          | Buyers and art directors; galleries grouped by market or series, with process work kept separate and low in the menu [10]                                       | Series galleries, artist statement, commissions/contact, process gallery                                   |
| Musicians & performers          | Bookers and fans: a one-line bio, a one-click play embed, 2–3 press quotes with sources, downloadable photos, shows, and booking contact at top and bottom [11] | Embed player, shows, short/long bio, press quotes, press photos, booking                                   |
| Architects & interior designers | Clients judging projects shown as hero image → title + quick facts (type, location, timeline, role) → short story → grouped images → next step [12]             | Project grid, project facts, process, services, contact                                                    |
| Job seekers                     | Recruiters doing a fast first scan (TheLadders' eye-tracking put an initial résumé screen at ~7.4 seconds [1])                                                  | One page: summary, experience, education, skills, contact, printable                                       |
| Coaches & speakers              | Event planners wanting a clear headline, a 1–3 minute reel above the fold, topics, testimonials and logos, and easy booking [13]                                | Reel, topics/programmes, testimonials, logos, bio, booking                                                 |

### 2.3 Visual directions in current use

Current portfolio design leans on a small set of distinct directions [14]. Each template below is built around one, so no two feel alike:

- **Text-led / large typography:** oversized headings, few or no images.
- **Editorial / magazine:** serif display type, block grids, rules between sections.
- **Brutalist:** raw borders, mono or grotesque type, visible structure.
- **Black and white with one accent:** monochrome chrome so work stands out.
- **Modular / masonry grids:** mixed-size work tiles.
- **Split screen:** colour blocks with the subject in the middle.
- **Soft / illustrated:** rounded shapes, warm palettes, gentle motion.
- **High contrast / neon accents:** dark ground with bright highlights.
- **Oversized portrait:** a large moody headshot paired with strong type.

## 3. How a template becomes its own style

The six store "website styles" cannot give 24 distinct identities, so portfolios get a **template style layer**:

- `site_templates.default_tokens.styleKey` is unique per portfolio template (e.g. `pf-terminal`). The renderer sets `data-template-style` on the page, and a dedicated `portfolio-styles.module.css` holds one block per style: type pairing, scale, spacing, radius, borders, section dividers, hero composition, card shape, and motion.
- **Section variants** differ per template (e.g. `projects:terminal-list`, `projects:case-study`, `gallery:justified`), so layout changes, not just colour.
- **Typography:** a curated set of open-licence (SIL OFL) variable fonts, **self-hosted** as Latin-subset `woff2` files and loaded with `next/font/local` only for the active template. That means at most two files per page and no runtime dependency on Google's servers. The proposed set is Inter, Manrope, Space Grotesk, JetBrains Mono, IBM Plex Sans, Archivo, Syne, Bricolage Grotesque, Fraunces, Instrument Serif, Playfair Display, DM Serif Display, Cormorant Garamond, and Libre Baskerville. System fonts remain the fallback stack.
- **Owners can switch template style later.** The style travels with the template's section variants. Any section a new style lacks a variant for falls back to that style's default variant, so switching never breaks the page.

## 4. The 24 templates

Each card lists the style idea, how the page is laid out, what makes it different, and its starter content. "Sample" items are seeded and locked for publishing until edited or removed (§5).

### Developers & engineers

**1. `developer` — Terminal** _(phase 1 key, restyled)_

- **Look:** near-black ground, JetBrains Mono headings with Inter body, green/cyan accent, 1px borders, square corners. Prompt-style eyebrows (`~/about`).
- **Layout:** centered hero → about → skills (`tags`, grouped by Languages / Frameworks / Tools) → projects (`terminal-list`: one row per project with stack chips and _repo_ / _live_ links) → experience (`timeline`) → contact.
- **Different because:** reads like a codebase, and scans in seconds for stack and links.
- **Starter:** 3 sample projects (an API service, a web app, an open-source tool), 2 sample roles, 12 sample skills.

**2. `developer-product` — Product engineer**

- **Look:** light, warm-white ground, Manrope, indigo accent, soft cards with 12px radius, generous whitespace.
- **Layout:** split hero (headline left, oversized headshot right) → projects (`case-study`: impact line + problem, role, outcome) → experience (`compact`) → skills (`grouped`) → writing/talks (`publications:list`) → contact.
- **Different because:** frames engineering work as product impact, for senior and product-minded roles.
- **Starter:** 2 sample case studies with outcome fields, 2 roles, 1 talk.

### Designers

**3. `designer` — Case study** _(phase 1 key, restyled)_

- **Look:** off-white, Instrument Serif display with Inter body, a single coral accent, 1px hairline dividers, large image frames.
- **Layout:** text-led hero (one sentence, very large) → projects (`featured`: 3 large stacked case-study cards, each opening a page structured problem → approach → process → result) → about (`photo-right`) → services ("What I do") → testimonials → contact.
- **Different because:** follows the case-study structure hiring managers expect [2], with process images before final screens.
- **Starter:** 3 sample case studies, each with all four story fields, 2 testimonials.

**4. `designer-bold` — Bold canvas**

- **Look:** brutalist: black/white with an electric yellow accent, Archivo Black headings, thick 3px borders, visible grid lines, square tiles.
- **Layout:** oversized-type hero → projects (`modular`: mixed-size tile grid with client/role labels on hover _and_ on tap) → stats (3 figures) → about → contact banner.
- **Different because:** made for brand, visual, and motion designers who want an attitude, without hiding the work.
- **Starter:** 6 sample tiles, 3 stats, 1 testimonial.

### Photographers

**5. `photographer` — Darkroom** _(phase 1 key, restyled)_

- **Look:** charcoal ground, Cormorant Garamond titles, Inter small caps for labels, gold accent, zero chrome around images.
- **Layout:** full-bleed hero image with name overlay → gallery (`masonry` with lightbox) → series list (each series opens a page) → about (`photo-left`) → booking/contact.
- **Different because:** image-first and immersive, suited to portrait, wedding, and fine-art photography [8].
- **Starter:** 2 sample series with neutral placeholder imagery (illustrated, not real people), about, booking copy.

**6. `photographer-gallery` — White wall**

- **Look:** pure white, Inter at small sizes, black text, no accent colour, wide margins.
- **Layout:** minimal header with name only → gallery (`justified` rows) → clients line → about (short) → contact.
- **Different because:** gallery-like neutrality, suited to commercial and product photographers who need uniform rows that maximise image size [8].
- **Starter:** 1 sample series with 9 placeholder frames, a sample client list.

### Writers & journalists

**7. `writer` — Editorial**

- **Look:** newspaper-like: Playfair Display headlines, Libre Baskerville body, ink-black on cream, thin rules between stories, a red accent for kickers.
- **Layout:** masthead hero (name as nameplate, beat as dateline) → clips (`publications:editorial`: outlet, headline, date, link, grouped by topic tabs) → about → testimonials → contact.
- **Different because:** clips are organised by topic and format so editors can scan [4].
- **Starter:** 6 sample clips across 2 topics, 2 sample editor testimonials.

**8. `writer-notebook` — Notebook**

- **Look:** text-only: Fraunces at large sizes, soft paper tone, generous line height, no images by default.
- **Layout:** large-type hero introduction paragraph → selected essays (`publications:index`, titles only with year) → newsletter/subscribe link (CTA) → about → contact.
- **Different because:** for essayists, poets, and bloggers who want reading comfort over visuals.
- **Starter:** 5 sample essay titles with summaries, a sample newsletter link.

### Freelancers & consultants

**9. `freelancer` — Studio of one**

- **Look:** clean and confident: Manrope, deep teal primary with a warm sand accent, rounded 10px cards, light ground.
- **Layout:** positioning hero ("I help **[who]** with **[what]**") with _Start a project_ and WhatsApp buttons → services (`cards`, each framed as a client problem) → process (4 steps) → projects (`case-study`) → testimonials → CTA banner → contact.
- **Different because:** built to convert visitors into enquiries, with services before portfolio, per freelancer conversion guidance [3].
- **Starter:** 3 sample services, 4 process steps, 2 case studies, 2 specific testimonials.

**10. `freelancer-results` — Results**

- **Look:** dark navy with a lime accent, Space Grotesk, big numerals, thin borders.
- **Layout:** hero with 3 headline stats → logos strip ("Clients I've worked with") → case studies (`metrics`: before/after figures) → services (`list`) → testimonials → contact.
- **Different because:** for marketers, growth consultants, and analysts whose value is measurable. Outcome figures are optional so nothing is invented.
- **Starter:** 3 sample stats, 6 sample logo placeholders (labelled "Sample client"), 2 case studies.

### Creative studios & agencies

**11. `creative-studio` — Agency**

- **Look:** Syne extra-bold headings, black ground with one saturated accent, full-bleed imagery, tight grid.
- **Layout:** full-bleed showreel image hero → work (`modular` masonry grid with client and discipline labels) → services → logos → team (2–4 people) → contact.
- **Different because:** shows range and scale, with the work as the hero.
- **Starter:** 6 sample work tiles, 4 services, 2 team members, sample logos.

**12. `studio-atelier` — Atelier**

- **Look:** warm and crafted: Fraunces headings, terracotta and olive palette, organic rounded shapes, split-screen colour blocks.
- **Layout:** split hero (colour block + image) → selected work (`curated`: 4 projects, large) → approach (3 values) → services → testimonials → contact.
- **Different because:** boutique studios, interior and product craft, smaller and more personal.
- **Starter:** 4 sample projects, 3 approach values, 2 testimonials.

### Academics & researchers

**13. `academic` — Scholar**

- **Look:** classic and calm: Libre Baskerville body, Inter labels, navy and white, two colours only, dense but well spaced, following the academic-site guidance [9].
- **Layout:** profile hero (photo, title, institution, research line) → research interests → publications (`publications:citation`: authors, title, venue, year, DOI/link; filter by year) → teaching → awards → talks → contact.
- **Different because:** works as a detailed online CV in a citation-first format.
- **Starter:** 4 sample publications, 2 courses, 2 awards, 1 talk.

**14. `academic-lab` — Lab**

- **Look:** modern sans (IBM Plex Sans), white with a teal accent, card-based, small diagrams optional.
- **Layout:** hero with research statement → research themes (3 cards) → news/updates list → publications (`compact`) → people/collaborators → talks → contact.
- **Different because:** for researchers leading groups or projects and communicating to a wider public.
- **Starter:** 3 sample themes, 3 news items, 4 publications, 2 collaborators.

### Artists & illustrators

**15. `artist` — Salon**

- **Look:** gallery walls: warm white, DM Serif Display titles, small caption type, works shown with generous mats.
- **Layout:** quiet hero with one featured work → series (`gallery:series`, one gallery per body of work) → artist statement → exhibitions/awards → commissions & contact; process gallery last in the menu [10].
- **Different because:** presents fine art and painting as exhibition rooms.
- **Starter:** 2 sample series of 6 placeholder works, a statement, 2 exhibitions.

**16. `artist-sketchbook` — Sketchbook**

- **Look:** playful: Bricolage Grotesque, a bright multi-colour palette, rounded 24px corners, hand-drawn-style underline accents, soft motion.
- **Layout:** illustrated hero → work grouped by market (`gallery:markets`, e.g. Editorial, Children's books, Packaging) [10] → clients → about → commissions form/contact → sketchbook gallery.
- **Different because:** made for illustrators selling to art directors.
- **Starter:** 3 sample market galleries, sample client list, commission info.

### Musicians & performers

**17. `musician` — Stage**

- **Look:** dark ground with neon accent (magenta or electric blue), Archivo condensed headings, high contrast, poster-like.
- **Layout:** full-bleed hero with latest release and **Listen** button → featured track (`embed`) → shows (`events`: date, city, venue, ticket link) → videos → about (short bio) → booking & press contacts.
- **Different because:** fan-facing and release-driven.
- **Starter:** 1 sample embed placeholder (not a real track), 3 sample shows, short bio.

**18. `musician-epk` — Press kit**

- **Look:** clean editorial: Inter + Fraunces, white with black type, one brand colour, structured blocks.
- **Layout:** one-line bio hero → featured track (`embed`) → bios (one-liner, short, long, with copy buttons) → press quotes (2–3 with source) → press photos (downloadable, credited) → shows → booking/press/management contacts at top and bottom [11].
- **Different because:** an electronic press kit for bookers and press, not fans.
- **Starter:** 3 bio lengths, 3 sample press quotes labelled "Sample", 2 placeholder photos, sample contacts.

### Architects & interior designers

**19. `architect` — Monograph**

- **Look:** black and white with one accent, Inter with very large thin headings, a strict 12-column grid, square images.
- **Layout:** minimal hero (name + discipline) → projects (`grid`, each opening a page structured hero → title + quick facts → story → grouped images → next step [12]) → practice/about → services → recognition → contact.
- **Different because:** restrained, monograph-like, letting buildings carry the page.
- **Starter:** 3 sample projects with facts (type, location, year, role, status), 2 awards.

**20. `architect-material` — Material**

- **Look:** warm, tactile: stone, clay, and oak palette, Cormorant Garamond headings, large full-bleed imagery, split layouts.
- **Layout:** full-bleed hero image → featured project (split, large) → projects (`list` with location and year) → process (concept → design → build) → services → testimonials → contact.
- **Different because:** suited to interiors, residential, and landscape practice, and feels homely rather than corporate.
- **Starter:** 3 sample projects, 3 process steps, 2 testimonials.

### Job seekers (résumé)

**21. `resume` — One page** _(phase 1 key, restyled)_

- **Look:** crisp: Inter, navy and white, compact type scale, and a **print stylesheet** so the page prints to a clean A4 CV.
- **Layout:** name + role + summary → experience (`timeline` with bullet achievements) → education → skills (`grouped`) → certifications → contact + CV download link.
- **Different because:** built for the recruiter's first quick scan [1] and printable.
- **Starter:** 2 sample roles with 3 achievements each, 1 education, 10 skills, 2 certifications.

**22. `resume-sidebar` — Sidebar CV**

- **Look:** two-column on desktop with a sticky coloured sidebar (photo, contact, skills, languages) and IBM Plex Sans; stacks to a single column on mobile.
- **Layout:** sidebar (photo, contact, skills, languages, links) + main (summary → experience → projects → education → volunteering).
- **Different because:** a classic modern CV layout that keeps contact details always visible.
- **Starter:** same sample set as One page, plus 2 languages and 1 volunteering entry.

### Coaches & speakers

**23. `coach-speaker` — Keynote**

- **Look:** bold and bright: Space Grotesk headings, deep purple with a warm orange accent, big photography of the speaker on stage.
- **Layout:** hero with speaker reel (`video` embed, 1–3 minutes, above the fold) and **Book me to speak** → topics (3 cards) → logos of past events → testimonials from organisers → about → booking + one-sheet download link [13].
- **Different because:** made for event planners, the buyer for speakers.
- **Starter:** 1 sample reel placeholder, 3 sample topics, sample event logos, 2 organiser testimonials.

**24. `coach-warm` — Warm coach**

- **Look:** soft and friendly: Manrope, sage and cream palette, rounded 28px shapes, gentle illustration accents.
- **Layout:** oversized-portrait hero with a promise line → programmes/packages (`services:cards`) → how it works (3 steps) → client stories (testimonials) → about → booking with WhatsApp and email.
- **Different because:** for life, career, and wellness coaches selling programmes to individuals.
- **Starter:** 3 sample programmes, 3 steps, 3 sample client stories.

## 5. Starter content and the publish lock

### 5.1 Data model

- `content_blocks.sample_fields text[] not null default '{}'` lists the content fields still holding template sample text.
- `portfolio_items.is_sample boolean not null default false` marks seeded entries.
- `media_assets.is_sample boolean not null default false` marks placeholder images. These are platform-owned illustrations, never photos of real people.
- `site_templates.default_sections` and a new `default_items jsonb` hold the sample content; seeding copies it and sets the markers.

### 5.2 Rules

- **A section field counts as edited** when its saved value differs from the template's sample value. The save RPC removes it from `sample_fields`. Clearing a field also counts.
- **A sample entry is cleared** by deleting it, or by saving it with every sample text field changed. Changing one word of a sample project is not enough; each placeholder field (title, summary, body, role, outcome) must differ from its sample value or be empty.
- **Sample images** must be replaced or removed.
- **Hidden doesn't count.** Turning a section off or archiving an entry takes its samples out of the check, because unpublished content is never shown.

### 5.3 Enforcement

- **In the database:** the `tenant_site_versions` insert trigger rejects a portfolio publish with `STARTER_CONTENT_PRESENT` if any enabled section has `sample_fields`, any active entry `is_sample`, or any published section references a sample image. The error detail lists them (section and field, or entry title) so the UI can point to each one. Draft saves and preview are never blocked.
- **In the interface:** sample fields and entries get a "Sample — edit or remove before publishing" badge, and the preview shows a "Sample content" ribbon. The publish button stays disabled behind a checklist ("4 sample items left") whose entries link to the exact field. The owner checklist gains "Replace the sample content".
- **Existing phase-1 portfolios:** a data migration marks their still-unedited template text as `sample_fields`, so the rule applies to them too.

## 6. New sections needed by these templates

These are added to the section list in the parent plan (§4):

| Block type      | Used by                      | Notes                                                                                                                                                                                                                                                  |
| --------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `embed`         | Musician, speaker            | **Allowlisted providers only**, matched by URL pattern and rendered as sandboxed iframes: Spotify, Apple Music, Audiomack, Boomplay, SoundCloud, YouTube, Vimeo. Each one is chosen by the owner and needs a `frame-src` CSP entry. No arbitrary HTML. |
| `events`        | Musician                     | Date, city, venue, ticket link (https); past shows auto-move to "Recent".                                                                                                                                                                              |
| `press`         | Musician EPK, writer         | Quote + source (outlet/writer) + optional link.                                                                                                                                                                                                        |
| `bios`          | Musician EPK                 | One-liner / short / long, with copy buttons.                                                                                                                                                                                                           |
| `logos`         | Freelancer, studio, speaker  | Client/event logos; sample logos are labelled.                                                                                                                                                                                                         |
| `process`       | Freelancer, architect, coach | 3–4 numbered steps.                                                                                                                                                                                                                                    |
| `topics`        | Speaker                      | Title + summary + audience.                                                                                                                                                                                                                            |
| `team`          | Studio, lab                  | Name, role, photo.                                                                                                                                                                                                                                     |
| `downloads`     | EPK, speaker, résumé         | **Links only** to files hosted elsewhere (https), matching the parent plan's no-PDF-upload rule for v1.                                                                                                                                                |
| `project-facts` | Architect (project pages)    | Type, location, year, size, status, role.                                                                                                                                                                                                              |

## 7. Delivery

The work spreads across the parent plan's phases:

- **Phase 2 (builder):**
  - entries and the section editors
  - the `sample_fields` / `is_sample` model and publish lock
  - restyling of the four phase-1 templates into Terminal, Case study, Darkroom, and One page
  - the template style layer and self-hosted fonts
- **Phase 3 (library):**
  - the remaining 20 templates and new sections
  - the `/get-started` template gallery, with a live preview per template
  - Super Admin template on/off
- **Each template is done when:**
  - its starter content renders, and the publish lock blocks it in a SQL test
  - it is screenshot-verified at 390px and 1440px
  - it passes contrast checks
  - its pages stay within the weight budget (two fonts and lazy images)

## 8. Sources

1. Fueler — _Your Portfolio Has 7 Seconds: What Recruiters Actually Look at First_ (cites TheLadders 2018; LinkedIn 2025). https://www.fueler.io/blog/your-portfolio-has-7-seconds-what-recruiters-look-at-first
2. UX Design Institute — _What hiring managers look for in a UX portfolio_. https://www.uxdesigninstitute.com/blog/hiring-managers-ux-portfolio/
3. Fueler — _How to Create a Freelancer Portfolio Website That Converts Clients_. https://fueler.io/blog/how-to-create-a-freelancer-portfolio-website-that-converts-clients
4. Ndash — _What Does a Writer's Portfolio Look Like_. https://www.ndash.com/blog/what-does-a-writers-portfolio-look-like
5. Technology Checker — _Mobile Internet Usage by Country_ (Cloudflare Radar, Q3 2026). https://technologychecker.io/blog/mobile-internet-usage-by-country
6. Brand Spur — _WhatsApp Installed On 95% Of Nigerian Smartphones_ (Orange Group / KPMG Nigeria Smartphone Study 2025). https://brandspurng.com/2026/09/26/whatsapp-installed-on-95-of-nigerian-smartphones-study-finds/
7. BusinessDay — _Nigerians spent nearly one fifth of poverty income on data in Q1_. https://businessday.ng/technology/article/nigerians-spent-nearly-one-fifth-of-poverty-income-on-data-in-q1/
8. Pixpa — _Ways to showcase your photo gallery on a portfolio website_. https://www.pixpa.com/blog/ways-to-showcase-your-photo-gallery-on-a-portfolio-website
9. Elsevier — _Creating a simple and effective academic personal website_. https://www.elsevier.com/connect/creating-a-simple-and-effective-academic-personal-website
10. Portfoliobox — _Illustration portfolio structure: organizing web galleries_. https://www.portfoliobox.com/magazine/illustration-portfolio-structure-organizing-web-galleries
11. Noiseyard — _What to Include in an EPK: 6 Sections Bookers Look For_. https://noiseyard.com/en/blog-for-musicians/what-to-include-in-an-epk
12. Silvermine — _Architecture portfolio website design: how to structure project pages that sell the work_. https://www-silvermine-ai.pages.dev/newsletter/architecture-portfolio-website-design-how-to-structure-project-pages-that-sell-the-work
13. SpeakerHub — _Is your website driving away or attracting event planners?_ https://www.speakerhub.com/skillcamp/your-website-driving-away-or-attracting-event-planners
14. Design Shack — _30+ Portfolio Design Trends_. https://designshack.net/articles/trends/portfolio-design
