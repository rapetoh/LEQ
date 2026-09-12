import { NavLink, Outlet } from 'react-router'
import { useSession } from './auth/sessionContext'
import { Icone, type NomIcone } from './composants/Icone'
import { fr } from './fr'
import styles from './Layout.module.css'

const LIENS = [
  { vers: '/', libelle: fr.navigation.accueil, icone: 'accueil' as NomIcone, fin: true },
  {
    vers: '/configuration',
    libelle: fr.navigation.configuration,
    icone: 'configuration' as NomIcone,
    fin: false,
  },
  { vers: '/drapeaux', libelle: fr.navigation.drapeaux, icone: 'drapeaux' as NomIcone, fin: false },
  { vers: '/defis', libelle: fr.navigation.defis, icone: 'defis' as NomIcone, fin: false },
  {
    vers: '/exercices',
    libelle: fr.navigation.exercices,
    icone: 'exercices' as NomIcone,
    fin: false,
  },
  {
    vers: '/recompenses',
    libelle: fr.navigation.recompenses,
    icone: 'recompenses' as NomIcone,
    fin: false,
  },
  { vers: '/echanges', libelle: fr.navigation.echanges, icone: 'echanges' as NomIcone, fin: false },
  { vers: '/grille', libelle: fr.navigation.grille, icone: 'grille' as NomIcone, fin: false },
  { vers: '/annonces', libelle: fr.navigation.annonces, icone: 'annonces' as NomIcone, fin: false },
  { vers: '/ateliers', libelle: fr.navigation.ateliers, icone: 'ateliers' as NomIcone, fin: false },
  { vers: '/sujets', libelle: fr.navigation.sujets, icone: 'sujets' as NomIcone, fin: false },
  { vers: '/theses', libelle: fr.navigation.theses, icone: 'theses' as NomIcone, fin: false },
  {
    vers: '/moderation',
    libelle: fr.navigation.moderation,
    icone: 'moderation' as NomIcone,
    fin: false,
  },
  {
    vers: '/utilisateurs',
    libelle: fr.navigation.utilisateurs,
    icone: 'utilisateurs' as NomIcone,
    fin: false,
  },
  { vers: '/exports', libelle: fr.navigation.exports, icone: 'exports' as NomIcone, fin: false },
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
              <Icone nom={lien.icone} />
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
