import type { ReactNode } from 'react';
import { cloudinaryImage, cloudinarySrcSet } from '@/lib/cloudinary/delivery';
import type { SiteConfiguration, SiteSection } from '@/modules/content/types';
import { partEntryType } from '@/modules/portfolio/entries';
import type { PublishedPortfolioEntry } from '@/modules/portfolio/types';
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

function formatMonth(value: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' }).format(
    new Date(`${value.slice(0, 10)}T00:00:00`),
  );
}

function dateRange(entry: PublishedPortfolioEntry) {
  if (!entry.startsOn) return '';
  return `${formatMonth(entry.startsOn)} – ${entry.isCurrent ? 'Present' : formatMonth(entry.endsOn) || ''}`;
}

/** Only https links reach the snapshot (database check); external links open safely. */
function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span aria-hidden="true"> ↗</span>
      <span className={styles.visuallyHidden}> (opens in a new tab)</span>
    </a>
  );
}

function SectionShell({
  section,
  children,
  wide = false,
}: {
  section: SiteSection;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <section
      className={styles.section}
      id={section.key}
      aria-labelledby={`${section.key}-title`}
      data-part={section.type}
      data-look={section.variant}
    >
      <header className={wide ? styles.sectionHeaderWide : styles.sectionHeader}>
        <h2 id={`${section.key}-title`}>{text(section, 'heading')}</h2>
        {text(section, 'intro') && <p className={styles.intro}>{text(section, 'intro')}</p>}
      </header>
      {children}
    </section>
  );
}

function ProjectCard({
  entry,
  large = false,
  keepShape = false,
}: {
  entry: PublishedPortfolioEntry;
  large?: boolean;
  keepShape?: boolean;
}) {
  // Masonry keeps each picture's own shape; large cards use a wide crop, others 4:3.
  // Fixed crops centre on the subject automatically (Cloudinary g_auto).
  const coverAspect = large ? 16 / 9 : 4 / 3;
  return (
    <article className={`${styles.project} ${large ? styles.projectLarge : ''}`}>
      {entry.cover && (
        // eslint-disable-next-line @next/next/no-img-element -- Cloudinary URL is tenant data.
        <img
          className={`${styles.projectCover} ${keepShape ? styles.projectCoverNatural : ''}`}
          src={cloudinaryImage(entry.cover.url, {
            width: 900,
            aspect: keepShape ? undefined : coverAspect,
          })}
          srcSet={cloudinarySrcSet(
            entry.cover.url,
            [480, 900, 1400],
            keepShape ? undefined : coverAspect,
          )}
          sizes={large ? '(min-width: 1120px) 1120px, 100vw' : '(min-width: 760px) 33vw, 100vw'}
          alt={entry.cover.alt ?? ''}
          loading="lazy"
          decoding="async"
        />
      )}
      <div className={styles.projectBody}>
        {entry.subtitle && <p className={styles.kicker}>{entry.subtitle}</p>}
        <h3>{entry.title}</h3>
        {entry.summary && <p>{entry.summary}</p>}
        {(entry.role || entry.outcome) && (
          <dl className={styles.facts}>
            {entry.role && (
              <div>
                <dt>My role</dt>
                <dd>{entry.role}</dd>
              </div>
            )}
            {entry.outcome && (
              <div>
                <dt>Result</dt>
                <dd>{entry.outcome}</dd>
              </div>
            )}
          </dl>
        )}
        {entry.tags.length > 0 && (
          <ul className={styles.tags} aria-label="Tools and topics">
            {entry.tags.map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
        )}
        {(entry.linkUrl || entry.sourceUrl) && (
          <p className={styles.links}>
            {entry.linkUrl && <ExternalLink href={entry.linkUrl}>View</ExternalLink>}
            {entry.sourceUrl && <ExternalLink href={entry.sourceUrl}>Source</ExternalLink>}
          </p>
        )}
      </div>
    </article>
  );
}

function Projects({
  section,
  entries,
}: {
  section: SiteSection;
  entries: PublishedPortfolioEntry[];
}) {
  if (section.variant === 'list') {
    return (
      <SectionShell section={section}>
        <ol className={styles.projectList}>
          {entries.map((entry) => (
            <li key={entry.id}>
              <div>
                {entry.subtitle && <p className={styles.kicker}>{entry.subtitle}</p>}
                <h3>{entry.title}</h3>
                {entry.summary && <p>{entry.summary}</p>}
                {entry.tags.length > 0 && (
                  <ul className={styles.tags} aria-label="Tools and topics">
                    {entry.tags.map((tag) => (
                      <li key={tag}>{tag}</li>
                    ))}
                  </ul>
                )}
              </div>
              <p className={styles.links}>
                {entry.linkUrl && <ExternalLink href={entry.linkUrl}>View</ExternalLink>}
                {entry.sourceUrl && <ExternalLink href={entry.sourceUrl}>Source</ExternalLink>}
              </p>
            </li>
          ))}
        </ol>
      </SectionShell>
    );
  }
  const layout =
    section.variant === 'featured'
      ? styles.projectsFeatured
      : section.variant === 'masonry'
        ? styles.projectsMasonry
        : styles.projectsGrid;
  return (
    <SectionShell section={section} wide>
      <div className={layout}>
        {entries.map((entry) => (
          <ProjectCard
            entry={entry}
            large={section.variant === 'featured'}
            keepShape={section.variant === 'masonry'}
            key={entry.id}
          />
        ))}
      </div>
    </SectionShell>
  );
}

function Timeline({
  section,
  entries,
}: {
  section: SiteSection;
  entries: PublishedPortfolioEntry[];
}) {
  return (
    <SectionShell section={section}>
      <ol className={section.variant === 'compact' ? styles.compactList : styles.timeline}>
        {entries.map((entry) => (
          <li key={entry.id}>
            <div className={styles.timelineHead}>
              <h3>{entry.title}</h3>
              {dateRange(entry) && <p className={styles.dates}>{dateRange(entry)}</p>}
            </div>
            {entry.subtitle && <p className={styles.kicker}>{entry.subtitle}</p>}
            {entry.summary && section.variant !== 'compact' && <p>{entry.summary}</p>}
          </li>
        ))}
      </ol>
    </SectionShell>
  );
}

function Skills({
  section,
  entries,
}: {
  section: SiteSection;
  entries: PublishedPortfolioEntry[];
}) {
  if (section.variant === 'grouped') {
    return (
      <SectionShell section={section}>
        <div className={styles.skillGroups}>
          {entries.map((entry) => (
            <div key={entry.id}>
              <h3>{entry.title}</h3>
              <ul className={styles.tags}>
                {entry.tags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </SectionShell>
    );
  }
  const all = [...new Set(entries.flatMap((entry) => entry.tags))];
  return (
    <SectionShell section={section}>
      <ul className={`${styles.tags} ${styles.tagsLarge}`}>
        {all.map((tag) => (
          <li key={tag}>{tag}</li>
        ))}
      </ul>
    </SectionShell>
  );
}

function ContactSection({
  section,
  business,
}: {
  section: SiteSection;
  business: SiteConfiguration['business'];
}) {
  // Email first; WhatsApp only appears when the owner has added a number (owner decision).
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
              <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer">
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
 * Renders a portfolio-only section, `null` when it has nothing to show yet, or
 * `undefined` when the type is shared (hero, announcement) so the caller handles it.
 */
export function renderPortfolioSection(
  section: SiteSection,
  configuration: SiteConfiguration,
): ReactNode | undefined {
  const entryType = partEntryType[section.type];
  if (entryType) {
    const entries = (configuration.portfolioItems ?? []).filter(
      (entry) => entry.type === entryType,
    );
    // A list part with no visible entries is omitted rather than showing an empty heading.
    if (!entries.length) return null;
    if (section.type === 'projects')
      return <Projects section={section} entries={entries} key={section.key} />;
    if (section.type === 'skills')
      return <Skills section={section} entries={entries} key={section.key} />;
    return <Timeline section={section} entries={entries} key={section.key} />;
  }
  if (section.type === 'about') {
    const photo = (section.settings as { photo?: { url?: string; alt?: string | null } }).photo;
    const showPhoto = Boolean(photo?.url) && section.variant !== 'text';
    return (
      <section
        className={styles.section}
        id={section.key}
        aria-labelledby={`${section.key}-title`}
        data-look={section.variant}
        key={section.key}
      >
        <div
          className={showPhoto ? styles.aboutWithPhoto : styles.about}
          data-look={section.variant}
        >
          {showPhoto && photo?.url && (
            // eslint-disable-next-line @next/next/no-img-element -- Cloudinary URL is tenant data.
            <img
              className={styles.aboutPhoto}
              src={cloudinaryImage(photo.url, { width: 800, aspect: 4 / 5 })}
              srcSet={cloudinarySrcSet(photo.url, [400, 800, 1200], 4 / 5)}
              sizes="(min-width: 760px) 40vw, 100vw"
              alt={photo.alt ?? ''}
              loading="lazy"
              decoding="async"
            />
          )}
          {showPhoto ? (
            <div className={styles.aboutText}>
              <h2 id={`${section.key}-title`}>{text(section, 'heading')}</h2>
              <div className={styles.prose}>
                <Paragraphs value={text(section, 'body')} />
              </div>
            </div>
          ) : (
            <>
              <h2 id={`${section.key}-title`}>{text(section, 'heading')}</h2>
              <div className={styles.prose}>
                <Paragraphs value={text(section, 'body')} />
              </div>
            </>
          )}
        </div>
      </section>
    );
  }
  if (section.type === 'contact') {
    return <ContactSection section={section} business={configuration.business} key={section.key} />;
  }
  return undefined;
}
