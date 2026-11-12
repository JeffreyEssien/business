-- Portfolio builder, phase 2: template style layer (docs/plans/portfolio-templates.md §3–4).
-- Each launch template gets its own style key, palette, and section layouts. The style
-- key selects self-hosted fonts and layout rules in the renderer; owners keep every
-- piece of content they have written.

update public.site_templates set
  name = 'Terminal',
  description = 'A dark, code-like portfolio that scans in seconds for stack, projects, and links.',
  default_tokens = '{"primary":"#3ddc97","secondary":"#8b949e","accent":"#58c4dc","background":"#0d1117","text":"#e6edf3","styleKey":"professional-modern","templateStyle":"pf-terminal"}',
  default_sections = (
    select jsonb_agg(case when s ->> 'type' = 'projects' then s || '{"variant":"list"}' else s end order by ord)
    from jsonb_array_elements(default_sections) with ordinality e(s, ord))
where key = 'developer';

update public.site_templates set
  name = 'Case study',
  description = 'An airy, text-led portfolio built around problem, approach, and result.',
  default_tokens = '{"primary":"#1d1d1f","secondary":"#6e6e73","accent":"#e5482a","background":"#fafaf7","text":"#1d1d1f","styleKey":"clean-minimal","templateStyle":"pf-case-study"}',
  default_sections = (
    select jsonb_agg(case when s ->> 'type' = 'hero' then s || '{"variant":"centered"}' else s end order by ord)
    from jsonb_array_elements(default_sections) with ordinality e(s, ord))
where key = 'designer';

update public.site_templates set
  name = 'Darkroom',
  description = 'An image-first, gallery-dark portfolio for portrait, event, and fine-art work.',
  default_tokens = '{"primary":"#c9a46a","secondary":"#8f8577","accent":"#c9a46a","background":"#121110","text":"#f2ede4","styleKey":"elegant-luxury","templateStyle":"pf-darkroom"}'
where key = 'photographer';

update public.site_templates set
  name = 'One page',
  description = 'A crisp one-page CV that recruiters can scan quickly and print cleanly.',
  default_tokens = '{"primary":"#1f3a64","secondary":"#5b6b82","accent":"#b7791f","background":"#ffffff","text":"#1d2733","styleKey":"clean-minimal","templateStyle":"pf-one-page"}'
where key = 'resume';

-- Existing portfolios on these templates adopt the new style. Owners cannot edit
-- portfolio colours yet, so their current palette is still the template's.
update public.tenant_theme_settings th
set tokens = st.default_tokens
from public.tenants t join public.site_templates st on st.key = t.template_key
where th.tenant_id = t.id and t.site_kind = 'PORTFOLIO'
  and st.default_tokens ? 'templateStyle';
