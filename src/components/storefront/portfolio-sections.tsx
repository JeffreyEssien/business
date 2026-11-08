import type { ReactNode } from 'react';
import type { SiteConfiguration, SiteSection } from '@/modules/content/types';
import { entryBackedSectionTypes } from '@/modules/portfolio/sections';
import styles from './portfolio-sections.module.css';

function text(section: SiteSection, key: string) {
  const value = section.content[key];
  return typeof value === 'string' ? value : '';
}

/** Body copy is plain text; paragraphs are split on blank lines and rendered escaped. */
function Paragraphs({ value }: { value: string }) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph, index) => <p key={index}>{paragraph}</p>);
}

function ContactSection({
  section,
  business,
}: {
  section: SiteSection;
  business: SiteConfiguration['business'];
}) {
  const whatsapp = business.whatsapp?.replace(/\D/g, '');
  const phone = business.phone?.replace(/[^\d+]/g, '');
  return (
    <section className={styles.section} id={section.key} aria-labelledby={`${section.key}-title`}>
      <div className={styles.contact}>
        <div>
          <h2 id={`${section.key}-title`}>{text(section, 'heading')}</h2>
          <Paragraphs value={text(section, 'body')} />
        </div>
        <ul className={styles.contactLinks}>
          {business.contactEmail && (
            <li>
              <span>Email</span>
              <a href={`mailto:${business.contactEmail}`}>{business.contactEmail}</a>
            </li>
          )}
          {phone && (
            <li>
              <span>Phone</span>
              <a href={`tel:${phone}`}>{business.phone}</a>
            </li>
          )}
          {whatsapp && (
            <li>
              <span>WhatsApp</span>
              <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">
                Message on WhatsApp
              </a>
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}

/**
 * Renders a portfolio-only section, or `undefined` when the type is not a portfolio type
 * so the caller can fall through to shared sections (hero, announcement).
 */
export function renderPortfolioSection(
  section: SiteSection,
  configuration: SiteConfiguration,
): ReactNode | undefined {
  // Entry-backed sections list projects, roles, skills, or schooling. With no published
  // entries they are omitted instead of showing an empty heading.
  if (entryBackedSectionTypes.has(section.type)) return null;
  if (section.type === 'about') {
    return (
      <section
        className={styles.section}
        id={section.key}
        aria-labelledby={`${section.key}-title`}
        key={section.key}
      >
        <div className={styles.about}>
          <h2 id={`${section.key}-title`}>{text(section, 'heading')}</h2>
          <div className={styles.prose}>
            <Paragraphs value={text(section, 'body')} />
          </div>
        </div>
      </section>
    );
  }
  if (section.type === 'contact') {
    return <ContactSection section={section} business={configuration.business} key={section.key} />;
  }
  return undefined;
}
