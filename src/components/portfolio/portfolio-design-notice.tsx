import { entryBackedSectionTypes, portfolioSectionLanguage } from '@/modules/portfolio/sections';
import type { SiteSection } from '@/modules/content/types';
import editorStyles from '@/components/content/site-editor.module.css';
import styles from './portfolio-design.module.css';

/**
 * Phase 1 portfolio design panel: explains what each template section shows today.
 * Section text and entry editing are delivered in the builder phase (ADR 004).
 */
export function PortfolioDesignNotice({ sections }: { sections: SiteSection[] }) {
  return (
    <section className={editorStyles.editorPanel} aria-labelledby="portfolio-sections-heading">
      <div className={styles.notice}>
        <h2 id="portfolio-sections-heading">Your portfolio sections</h2>
        <p>
          Your template set up these sections. Reorder them above and publish when you are ready.
          Editing section text, projects, and experience is coming in the next update.
        </p>
        <ul className={styles.sectionList}>
          {sections.map((section) => {
            const waiting = entryBackedSectionTypes.has(section.type);
            return (
              <li key={section.key}>
                <span>
                  <strong>{portfolioSectionLanguage[section.type]?.name ?? section.key}</strong>
                  <small>{portfolioSectionLanguage[section.type]?.description}</small>
                </span>
                <em className={waiting ? styles.waiting : styles.shown}>
                  {waiting ? 'Hidden until it has entries' : 'Shown'}
                </em>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
