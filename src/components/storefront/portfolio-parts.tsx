import type { ReactNode } from 'react';
import { cloudinaryImage, cloudinarySrcSet } from '@/lib/cloudinary/delivery';
import type { SiteSection } from '@/modules/content/types';
import { embedFromUrl } from '@/modules/portfolio/embeds';
import type { PublishedPortfolioEntry } from '@/modules/portfolio/types';
import { CopyTextButton } from './copy-text-button';
import { ExternalLink, Paragraphs, SectionShell, formatMonth, text } from './portfolio-sections';
import sectionStyles from './portfolio-sections.module.css';
import styles from './portfolio-parts.module.css';

/*
 * Phase-3 portfolio parts (docs/plans/portfolio-templates.md §7): writing, services,
 * testimonials, events, awards, clients, figures, steps, downloads, people, a song or
 * video player, bios, and a call to action. All text is rendered as escaped plain text,
 * and every link reached the snapshot through the database's https check.
 */

type Entries = PublishedPortfolioEntry[];

function year(value: string | null) {
  return value ? value.slice(0, 4) : '';
}

/** Title that links out when the entry has a link, plain otherwise. */
function Title({ entry, as: Tag = 'h3' }: { entry: PublishedPortfolioEntry; as?: 'h3' | 'p' }) {
  return (
    <Tag className={styles.entryTitle}>
      {entry.linkUrl ? (
        <ExternalLink href={entry.linkUrl}>{entry.title}</ExternalLink>
      ) : (
        entry.title
      )}
    </Tag>
  );
}

function Publications({ section, entries }: { section: SiteSection; entries: Entries }) {
  if (section.variant === 'editorial') {
    const groups = new Map<string, Entries>();
    for (const entry of entries) {
      const topic = entry.tags[0] || 'More';
      groups.set(topic, [...(groups.get(topic) ?? []), entry]);
    }
    return (
      <SectionShell section={section} wide>
        <div className={styles.topics}>
          {[...groups].map(([topic, items]) => (
            <section key={topic} aria-label={topic}>
              <h3 className={styles.topic}>{topic}</h3>
              <ol className={styles.clips}>
                {items.map((entry) => (
                  <li key={entry.id}>
                    {entry.subtitle && <p className={sectionStyles.kicker}>{entry.subtitle}</p>}
                    <Title entry={entry} as="p" />
                    {entry.startsOn && <p className={styles.meta}>{formatMonth(entry.startsOn)}</p>}
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </SectionShell>
    );
  }
  if (section.variant === 'index') {
    return (
      <SectionShell section={section}>
        <ol className={styles.index}>
          {entries.map((entry) => (
            <li key={entry.id}>
              <div>
                <Title entry={entry} />
                {entry.summary && <p>{entry.summary}</p>}
              </div>
              <span className={styles.meta}>{year(entry.startsOn)}</span>
            </li>
          ))}
        </ol>
      </SectionShell>
    );
  }
  if (section.variant === 'citation') {
    return (
      <SectionShell section={section}>
        <ol className={styles.citations}>
          {entries.map((entry) => (
            <li key={entry.id}>
              {entry.role && <span>{entry.role} </span>}
              {entry.startsOn && <span>({year(entry.startsOn)}). </span>}
              <strong>{entry.title}.</strong> {entry.subtitle && <em>{entry.subtitle}.</em>}{' '}
              {entry.linkUrl && <ExternalLink href={entry.linkUrl}>Read</ExternalLink>}
            </li>
          ))}
        </ol>
      </SectionShell>
    );
  }
  return (
    <SectionShell section={section}>
      <ol className={styles.rows}>
        {entries.map((entry) => (
          <li key={entry.id}>
            <p className={sectionStyles.kicker}>
              {[entry.subtitle, year(entry.startsOn)].filter(Boolean).join(' · ')}
            </p>
            <Title entry={entry} />
            {entry.summary && <p>{entry.summary}</p>}
          </li>
        ))}
      </ol>
    </SectionShell>
  );
}

function Services({ section, entries }: { section: SiteSection; entries: Entries }) {
  return (
    <SectionShell section={section} wide>
      <ul className={section.variant === 'list' ? styles.rows : styles.cards}>
        {entries.map((entry) => (
          <li key={entry.id}>
            <h3 className={styles.entryTitle}>{entry.title}</h3>
            {entry.subtitle && <p className={sectionStyles.kicker}>{entry.subtitle}</p>}
            {entry.summary && <p>{entry.summary}</p>}
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}

function Testimonials({ section, entries }: { section: SiteSection; entries: Entries }) {
  return (
    <SectionShell section={section} wide>
      <div className={section.variant === 'spotlight' ? styles.spotlight : styles.quotes}>
        {entries
          .filter((entry) => entry.summary)
          .map((entry) => (
            <figure key={entry.id} className={styles.quote}>
              <blockquote>
                <p>{entry.summary}</p>
              </blockquote>
              <figcaption>
                <strong>{entry.title}</strong>
                {entry.subtitle && <span>{entry.subtitle}</span>}
                {entry.linkUrl && <ExternalLink href={entry.linkUrl}>Source</ExternalLink>}
              </figcaption>
            </figure>
          ))}
      </div>
    </SectionShell>
  );
}

function EventRow({ entry, poster }: { entry: PublishedPortfolioEntry; poster: boolean }) {
  const date = entry.startsOn ? new Date(`${entry.startsOn.slice(0, 10)}T00:00:00`) : null;
  return (
    <li className={poster ? styles.posterRow : styles.eventRow}>
      {date && (
        <time className={styles.eventDate} dateTime={entry.startsOn!.slice(0, 10)}>
          <span>{date.getDate()}</span>
          <span>
            {new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' }).format(date)}
          </span>
        </time>
      )}
      <div>
        <h3 className={styles.entryTitle}>{entry.title}</h3>
        {entry.subtitle && <p className={styles.meta}>{entry.subtitle}</p>}
        {entry.summary && <p>{entry.summary}</p>}
      </div>
      {entry.linkUrl && (
        <a className={styles.ticket} href={entry.linkUrl} target="_blank" rel="noopener noreferrer">
          Tickets & details<span className={sectionStyles.visuallyHidden}> for {entry.title}</span>
        </a>
      )}
    </li>
  );
}

function Events({ section, entries }: { section: SiteSection; entries: Entries }) {
  // Past dates move to "Recent" by themselves, so owners never have to tidy the list.
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = entries
    .filter((entry) => !entry.startsOn || entry.startsOn.slice(0, 10) >= today)
    .sort((a, b) => (a.startsOn ?? '').localeCompare(b.startsOn ?? ''));
  const past = entries
    .filter((entry) => entry.startsOn && entry.startsOn.slice(0, 10) < today)
    .sort((a, b) => (b.startsOn ?? '').localeCompare(a.startsOn ?? ''));
  const poster = section.variant === 'poster';
  return (
    <SectionShell section={section} wide>
      {upcoming.length > 0 && (
        <ol className={styles.events}>
          {upcoming.map((entry) => (
            <EventRow key={entry.id} entry={entry} poster={poster} />
          ))}
        </ol>
      )}
      {past.length > 0 && (
        <>
          <h3 className={styles.subheading}>Recent</h3>
          <ol className={`${styles.events} ${styles.pastEvents}`}>
            {past.slice(0, 6).map((entry) => (
              <EventRow key={entry.id} entry={entry} poster={false} />
            ))}
          </ol>
        </>
      )}
    </SectionShell>
  );
}

function Awards({ section, entries }: { section: SiteSection; entries: Entries }) {
  return (
    <SectionShell section={section}>
      <ol className={section.variant === 'compact' ? styles.compactAwards : styles.rows}>
        {entries.map((entry) => (
          <li key={entry.id}>
            <Title entry={entry} />
            <p className={styles.meta}>
              {[entry.subtitle, year(entry.startsOn)].filter(Boolean).join(' · ')}
            </p>
            {entry.summary && section.variant !== 'compact' && <p>{entry.summary}</p>}
          </li>
        ))}
      </ol>
    </SectionShell>
  );
}

function Clients({ section, entries }: { section: SiteSection; entries: Entries }) {
  return (
    <SectionShell section={section} wide>
      <ul className={section.variant === 'grid' ? styles.clientGrid : styles.clientStrip}>
        {entries.map((entry) => {
          // A logo replaces the name; the name becomes its alt text so it is still read out.
          // Not lazy: with an automatic width it has no size until loaded, so it never would.
          const label = entry.cover ? (
            // eslint-disable-next-line @next/next/no-img-element -- Cloudinary URL is tenant data.
            <img
              className={styles.clientLogo}
              src={cloudinaryImage(entry.cover.url, { width: 320 })}
              alt={entry.title}
              decoding="async"
            />
          ) : (
            entry.title
          );
          return (
            <li key={entry.id}>
              {entry.linkUrl ? (
                <a href={entry.linkUrl} target="_blank" rel="noopener noreferrer">
                  {label}
                </a>
              ) : (
                label
              )}
            </li>
          );
        })}
      </ul>
    </SectionShell>
  );
}

function Stats({ section, entries }: { section: SiteSection; entries: Entries }) {
  return (
    <SectionShell section={section} wide>
      <dl className={section.variant === 'band' ? styles.statBand : styles.stats}>
        {entries.map((entry) => (
          <div key={entry.id}>
            <dt>{entry.summary}</dt>
            <dd>{entry.title}</dd>
          </div>
        ))}
      </dl>
    </SectionShell>
  );
}

function Process({ section, entries }: { section: SiteSection; entries: Entries }) {
  return (
    <SectionShell section={section} wide>
      <ol className={section.variant === 'columns' ? styles.stepColumns : styles.steps}>
        {entries.map((entry, index) => (
          <li key={entry.id}>
            <span className={styles.stepNumber} aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div>
              <h3 className={styles.entryTitle}>{entry.title}</h3>
              {entry.summary && <p>{entry.summary}</p>}
            </div>
          </li>
        ))}
      </ol>
    </SectionShell>
  );
}

function Downloads({ section, entries }: { section: SiteSection; entries: Entries }) {
  const links = entries.filter((entry) => entry.linkUrl);
  if (!links.length) return null;
  return (
    <SectionShell section={section}>
      <ul className={styles.downloads}>
        {links.map((entry) => (
          <li key={entry.id}>
            <a href={entry.linkUrl!} target="_blank" rel="noopener noreferrer">
              <strong>{entry.title}</strong>
              {entry.subtitle && <span>{entry.subtitle}</span>}
              <span className={sectionStyles.visuallyHidden}> (opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}

function Team({ section, entries }: { section: SiteSection; entries: Entries }) {
  return (
    <SectionShell section={section} wide>
      <ul className={section.variant === 'list' ? styles.rows : styles.team}>
        {entries.map((entry) => (
          <li key={entry.id}>
            {section.variant !== 'list' &&
              (entry.cover ? (
                // eslint-disable-next-line @next/next/no-img-element -- Cloudinary URL is tenant data.
                <img
                  className={styles.portrait}
                  src={cloudinaryImage(entry.cover.url, { width: 480, aspect: 1 })}
                  srcSet={cloudinarySrcSet(entry.cover.url, [240, 480, 720], 1)}
                  sizes="(min-width: 760px) 25vw, 50vw"
                  alt={entry.cover.alt ?? ''}
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <span className={styles.initials} aria-hidden="true">
                  {entry.title
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((word) => word[0])
                    .join('')}
                </span>
              ))}
            <Title entry={entry} />
            {entry.subtitle && <p className={styles.meta}>{entry.subtitle}</p>}
            {entry.summary && <p>{entry.summary}</p>}
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}

function EmbedPart({ section }: { section: SiteSection }) {
  const embed = embedFromUrl(text(section, 'url'));
  if (!embed) return null;
  return (
    <SectionShell section={section} wide>
      {embed.src ? (
        <div className={embed.kind === 'video' ? styles.videoFrame : styles.audioFrame}>
          {/* Players come only from allow-listed providers; the sandbox keeps them from
              navigating this page. */}
          <iframe
            src={embed.src}
            title={`${text(section, 'heading') || 'Player'} (${embed.label})`}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <p>
          <a className={styles.ticket} href={embed.href} target="_blank" rel="noopener noreferrer">
            Listen on {embed.label}
          </a>
        </p>
      )}
    </SectionShell>
  );
}

function Bios({ section }: { section: SiteSection }) {
  const bios = [
    ['oneLiner', 'One line', 'one-line bio'],
    ['short', 'Short bio', 'short bio'],
    ['long', 'Long bio', 'long bio'],
  ]
    .map(([key, label, copyLabel]) => ({ key, label, copyLabel, value: text(section, key) }))
    .filter((bio) => bio.value);
  if (!bios.length) return null;
  return (
    <SectionShell section={section}>
      <div className={styles.bios}>
        {bios.map((bio) => (
          <article key={bio.key}>
            <header>
              <h3 className={styles.entryTitle}>{bio.label}</h3>
              <CopyTextButton value={bio.value} label={bio.copyLabel} />
            </header>
            <div className={sectionStyles.prose}>
              <Paragraphs value={bio.value} />
            </div>
          </article>
        ))}
      </div>
    </SectionShell>
  );
}

function ctaOf(section: SiteSection) {
  const value = section.content.primaryCta;
  const item = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const label = typeof item.label === 'string' ? item.label : '';
  const href = typeof item.href === 'string' ? item.href : '';
  return label && href ? { label, href } : null;
}

function CallToAction({ section }: { section: SiteSection }) {
  const button = ctaOf(section);
  const external = button?.href.startsWith('https://');
  return (
    <section
      className={sectionStyles.section}
      id={section.key}
      aria-labelledby={`${section.key}-title`}
      data-part="cta"
      data-look={section.variant}
    >
      <div className={section.variant === 'banner' ? styles.ctaBanner : styles.ctaCentered}>
        <h2 id={`${section.key}-title`}>{text(section, 'heading')}</h2>
        {text(section, 'body') && <p>{text(section, 'body')}</p>}
        {button && (
          <a
            className={styles.ctaButton}
            href={button.href}
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {button.label}
          </a>
        )}
      </div>
    </section>
  );
}

const entryParts: Record<string, (props: { section: SiteSection; entries: Entries }) => ReactNode> =
  {
    publications: Publications,
    services: Services,
    testimonials: Testimonials,
    events: Events,
    awards: Awards,
    clients: Clients,
    stats: Stats,
    process: Process,
    downloads: Downloads,
    team: Team,
  };

/** Renders a phase-3 part, or `undefined` when the type is not one of them. */
export function renderPortfolioPart(section: SiteSection, entries: Entries): ReactNode | undefined {
  const Part = entryParts[section.type];
  if (Part) return <Part section={section} entries={entries} key={section.key} />;
  if (section.type === 'embed') return <EmbedPart section={section} key={section.key} />;
  if (section.type === 'bios') return <Bios section={section} key={section.key} />;
  if (section.type === 'cta') return <CallToAction section={section} key={section.key} />;
  return undefined;
}
