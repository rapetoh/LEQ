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
] as const

/** The shell: a left navigation, Rebecca's identity and sign-out, and the current page. */
export function Layout() {
  const { session, deconnecter } = useSession()
  const email = session?.user.email ?? ''

  return (
    <div className={styles.coquille}>
      <aside className={styles.barre}>
        <div className={styles.marque}>
          <span className={styles.nom}>{fr.app.nom}</span>
          <span className={styles.point} aria-hidden="true" />
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
