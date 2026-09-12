import { NavLink, Outlet } from 'react-router'
import { useSession } from './auth/sessionContext'
import { fr } from './fr'
import styles from './Layout.module.css'

const LIENS = [
  { vers: '/', libelle: fr.navigation.accueil, fin: true },
  { vers: '/configuration', libelle: fr.navigation.configuration, fin: false },
  { vers: '/drapeaux', libelle: fr.navigation.drapeaux, fin: false },
  { vers: '/defis', libelle: fr.navigation.defis, fin: false },
  { vers: '/exercices', libelle: fr.navigation.exercices, fin: false },
  { vers: '/recompenses', libelle: fr.navigation.recompenses, fin: false },
  { vers: '/echanges', libelle: fr.navigation.echanges, fin: false },
  { vers: '/grille', libelle: fr.navigation.grille, fin: false },
  { vers: '/annonces', libelle: fr.navigation.annonces, fin: false },
  { vers: '/ateliers', libelle: fr.navigation.ateliers, fin: false },
  { vers: '/sujets', libelle: fr.navigation.sujets, fin: false },
  { vers: '/theses', libelle: fr.navigation.theses, fin: false },
  { vers: '/moderation', libelle: fr.navigation.moderation, fin: false },
  { vers: '/utilisateurs', libelle: fr.navigation.utilisateurs, fin: false },
  { vers: '/exports', libelle: fr.navigation.exports, fin: false },
] as const

/** The shell: a left navigation, Rebecca's identity and sign-out, and the current page. */
export function Layout() {
  const { session, deconnecter } = useSession()
  const email = session?.user.email ?? ''

  return (
    <div className={styles.coquille}>
      <aside className={styles.barre}>
        <div className={styles.marque}>
          {/* The mark itself, not letters standing in for it: the sidebar is bleu nuit, so the
              white version. `fr.app.nom` stays as the alternative text. */}
          <img
            className={styles.sigle}
            src={`${import.meta.env.BASE_URL}marque/sigle-blanc.png`}
            alt={fr.app.nom}
            width={72}
            height={32}
          />
          <span className={styles.sousTitre}>{fr.app.sousTitre}</span>
        </div>
        <nav aria-label={fr.navigation.libelle} className={styles.navigation}>
          {LIENS.map((lien) => (
            <NavLink
              key={lien.vers}
              to={lien.vers}
              end={lien.fin}
              className={({ isActive }) => (isActive ? styles.lienActif : styles.lien)}
            >
              {lien.libelle}
            </NavLink>
          ))}
        </nav>
        <div className={styles.pied}>
          {email ? <p className={styles.email}>{email}</p> : null}
          <button
            type="button"
            className="bouton bouton-discret"
            onClick={() => void deconnecter()}
          >
            {fr.navigation.seDeconnecter}
          </button>
        </div>
      </aside>
      <main className={styles.contenu}>
        <Outlet />
      </main>
    </div>
  )
}
