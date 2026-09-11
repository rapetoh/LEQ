import { Link } from 'react-router'
import { fr } from '../fr'
import styles from './Accueil.module.css'

const DISPONIBLES = [
  { vers: '/configuration', ...fr.accueil.cartes.configuration },
  { vers: '/drapeaux', ...fr.accueil.cartes.drapeaux },
  { vers: '/defis', ...fr.accueil.cartes.defis },
  { vers: '/exercices', ...fr.accueil.cartes.exercices },
  { vers: '/recompenses', ...fr.accueil.cartes.recompenses },
  { vers: '/echanges', ...fr.accueil.cartes.echanges },
  { vers: '/grille', ...fr.accueil.cartes.grille },
  { vers: '/annonces', ...fr.accueil.cartes.annonces },
  { vers: '/ateliers', ...fr.accueil.cartes.ateliers },
  { vers: '/sujets', ...fr.accueil.cartes.sujets },
  { vers: '/moderation', ...fr.accueil.cartes.moderation },
  { vers: '/utilisateurs', ...fr.accueil.cartes.utilisateurs },
  { vers: '/exports', ...fr.accueil.cartes.exports },
] as const

const A_VENIR = [fr.accueil.aVenir.banques]

/** Home: what Rebecca can do today, and the space that comes next. No fake data. */
export function Accueil() {
  return (
    <div className="page">
      <header className="page-entete">
        <h1>{fr.accueil.titre}</h1>
        <p>{fr.accueil.intro}</p>
      </header>

      <section aria-labelledby="titre-disponible" className={styles.section}>
        <h2 id="titre-disponible">{fr.accueil.disponible}</h2>
        <div className={styles.grille}>
          {DISPONIBLES.map((carte) => (
            <article key={carte.vers} className={`carte ${styles.carte}`}>
              <h3>{carte.titre}</h3>
              <p className={styles.texte}>{carte.texte}</p>
              <Link to={carte.vers} className="bouton bouton-secondaire">
                {carte.action}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="titre-bientot" className={styles.section}>
        <h2 id="titre-bientot">{fr.accueil.bientot}</h2>
        <p className={styles.intro}>{fr.accueil.aVenirIntro}</p>
        <div className={styles.grille}>
          {A_VENIR.map((carte) => (
            <article key={carte.titre} className={`carte ${styles.carteBientot}`}>
              <span className={styles.badge}>{fr.accueil.bientot}</span>
              <h3>{carte.titre}</h3>
              <p className={styles.texte}>{carte.texte}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
