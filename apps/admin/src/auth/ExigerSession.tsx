import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { fr } from '../fr'
import { useSession } from './sessionContext'

/** Sends signed-out visitors to the login page and remembers where they wanted to go. */
export function ExigerSession({ children }: { children: ReactNode }) {
  const { statut, session } = useSession()
  const location = useLocation()

  if (statut === 'chargement') {
    return (
      <p className="etat" role="status">
        {fr.acces.verification}
      </p>
    )
  }

  if (!session) {
    return <Navigate to="/connexion" replace state={{ de: location.pathname }} />
  }

  return <>{children}</>
}
