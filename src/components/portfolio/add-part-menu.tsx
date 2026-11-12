import { addPart } from '@/modules/portfolio/actions';
import { addablePartTypes } from '@/modules/portfolio/entries';
import { portfolioSectionLanguage } from '@/modules/portfolio/sections';
import styles from './builder.module.css';

/** "Add a part": one big button per part, each with a one-line description. */
export function AddPartMenu({ slug }: { slug: string }) {
  return (
    <section aria-labelledby="add-part-heading">
      <h2 id="add-part-heading">Add a part to your page</h2>
      <ul className={styles.addGrid}>
        {addablePartTypes.map((type) => (
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
    </section>
  );
}
