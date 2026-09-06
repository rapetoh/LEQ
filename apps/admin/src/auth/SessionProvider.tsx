import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../services/supabase'
import { SessionContext, type EtatSession } from './sessionContext'

type Interne = Pick<EtatSession, 'statut' | 'session'>

export function SessionProvider({ children }: { children: ReactNode }) {
  const [etat, setEtat] = useState<Interne>({ statut: 'chargement', session: null })

  useEffect(() => {
    let actif = true

    // Read the persisted session once, then follow every auth event (sign in, refresh, sign out).
    void supabase.auth.getSession().then(({ data }) => {
      if (actif) setEtat({ statut: 'pret', session: data.session })
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_evenement, session: Session | null) => {
      setEtat({ statut: 'pret', session })
    })

    return () => {
      actif = false
      subscription.unsubscribe()
    }
  }, [])

  const deconnecter = useCallback(async () => {
    // A failed network call still clears the local session; the SIGNED_OUT event updates the state.
    await supabase.auth.signOut()
  }, [])

  const valeur = useMemo<EtatSession>(
    () => ({ statut: etat.statut, session: etat.session, deconnecter }),
    [etat, deconnecter],
  )

  return <SessionContext.Provider value={valeur}>{children}</SessionContext.Provider>
}
