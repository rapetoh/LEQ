import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export type EtatSession = {
  /** 'chargement' until the stored session has been read once. */
  statut: 'chargement' | 'pret'
  session: Session | null
  deconnecter: () => Promise<void>
}

export const SessionContext = createContext<EtatSession | null>(null)

export function useSession(): EtatSession {
  const etat = useContext(SessionContext)
  if (!etat) {
    throw new Error('useSession doit être appelé sous SessionProvider.')
  }
  return etat
}
