import type { ReactNode } from 'react'
import { fr } from '../fr'
import { estAdmin } from './role'
import { useSession } from './sessionContext'
import styles from './RoleGate.module.css'

/** Renders its children only for the admin role; anyone else sees a plain refusal and can sign out. */
export function RoleGate({ children }: { children: ReactNode }) {
  const { statut, session, deconnecter } = useSession()

  if (statut === 'chargement') {
    return (
      <p className={styles.attente} role="status">
        {fr.acces.verification}
      </p>
    )
  }

  if (estAdmin(session)) {
    return <>{children}</>
  }

  const email = session?.user.email

  return (
    <main className={styles.refus} aria-labelledby="titre-acces">
      <div className={styles.boite}>
        <img
          className={styles.sigle}
          src={`${import.meta.env.BASE_URL}marque/sigle-bleu-nuit.png`}
          alt={fr.app.nom}
        />
        <h1 id="titre-acces">{fr.acces.reserve}</h1>
        {email ? <p className={styles.detail}>{fr.acces.connecteAvec(email)}</p> : null}
        <button
          type="button"
          className="bouton bouton-secondaire"
          onClick={() => void deconnecter()}
        >
          {fr.navigation.seDeconnecter}
        </button>
      </div>
    </main>
  )
}
