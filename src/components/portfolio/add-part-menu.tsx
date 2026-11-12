import { addPart } from '@/modules/portfolio/actions';
import { addablePartTypes, commonPartTypes } from '@/modules/portfolio/entries';
import { portfolioSectionLanguage } from '@/modules/portfolio/sections';
import styles from './builder.module.css';

function PartButtons({ slug, types }: { slug: string; types: readonly string[] }) {
  return (
    <ul className={styles.addGrid}>
      {types.map((type) => (
        <li key={type}>
          <form action={addPart.bind(null, slug, type)}>
            <button className={styles.addCard} type="submit">
              <strong>+ {portfolioSectionLanguage[type].name}</strong>
              <span>{portfolioSectionLanguage[type].description}</span>
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}

/**
 * "Add a part": the parts most portfolios need come first; the rest wait behind
 * "More parts" so the first choice stays simple.
 */
export function AddPartMenu({ slug }: { slug: string }) {
  const common = addablePartTypes.filter((type) => commonPartTypes.includes(type));
  const more = addablePartTypes.filter((type) => !commonPartTypes.includes(type));
  return (
    <section aria-labelledby="add-part-heading">
      <h2 id="add-part-heading">Add a part to your page</h2>
      <PartButtons slug={slug} types={common} />
      {more.length > 0 && (
        <details className={styles.moreParts}>
          <summary>More parts ({more.length})</summary>
          <PartButtons slug={slug} types={more} />
        </details>
      )}
    </section>
  );
}
