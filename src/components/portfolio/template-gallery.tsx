import Link from 'next/link';
import { portfolioFontVariables } from '@/components/storefront/portfolio-fonts';
import storefront from '@/components/storefront/storefront.module.css';
import { audienceGroups, type LibraryTemplate } from '@/modules/portfolio/template-library';
import styles from './template-gallery.module.css';

/**
 * A small poster of a template in its own colours and heading font. It reuses the
 * storefront's template-style rules so the sample type matches the real page.
 */
function TemplateThumb({ template }: { template: LibraryTemplate }) {
  const hero = template.sections[0]?.content as { eyebrow?: string };
  const { background, text, primary, accent } = template.tokens;
  return (
    <div
      className={`${storefront.storefront} ${portfolioFontVariables} ${styles.thumb}`}
      data-template-style={template.tokens.templateStyle}
      data-style={template.tokens.styleKey}
      style={{ background, color: text }}
      aria-hidden="true"
    >
      <span className={styles.thumbEyebrow} style={{ color: primary }}>
        {hero?.eyebrow}
      </span>
      <strong className={styles.thumbName}>{template.preview.name}</strong>
      <span className={styles.thumbBars}>
        <i style={{ background: primary }} />
        <i style={{ background: accent }} />
        <i style={{ background: text, opacity: 0.25 }} />
      </span>
    </div>
  );
}

/** "I take photographs" → "Take photographs" for the short jump links. */
function chipLabel(label: string) {
  const short = label.replace(/^I (am )?/, '');
  return short.charAt(0).toUpperCase() + short.slice(1);
}

export function TemplateGallery({ templates }: { templates: LibraryTemplate[] }) {
  const groups = audienceGroups
    .map((group) => ({
      ...group,
      templates: templates.filter((template) => template.audienceGroup === group.value),
    }))
    .filter((group) => group.templates.length > 0);
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>BUSINESSCARE PORTFOLIOS</p>
        <h1>Pick a look for your portfolio.</h1>
        <p>
          Every template arrives filled with example content, so you can see exactly how your work
          will look. You replace the examples with your own words and pictures, and you can change
          the look at any time without losing anything.
        </p>
        <nav aria-label="Jump to a kind of work">
          <ul className={styles.chips}>
            {groups.map((group) => (
              <li key={group.value}>
                <a href={`#${group.value}`}>{chipLabel(group.label)}</a>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      {groups.map((group) => (
        <section
          key={group.value}
          id={group.value}
          className={styles.group}
          aria-labelledby={`${group.value}-title`}
        >
          <h2 id={`${group.value}-title`}>{group.label}</h2>
          <ul className={styles.grid}>
            {group.templates.map((template) => (
              <li key={template.key}>
                <Link className={styles.card} href={`/templates/${template.key}`}>
                  <TemplateThumb template={template} />
                  <span className={styles.cardText}>
                    <strong>{template.name}</strong>
                    <span>{template.description}</span>
                    <em>See it with example content →</em>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
