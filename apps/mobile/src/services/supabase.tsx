import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient, processLock, type Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AppState, Platform } from 'react-native'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const clePubliable = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY

if (!url || !clePubliable) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY are missing. Copy .env.example to .env.',
  )
}

// Session persistence per the current Supabase React Native guide: AsyncStorage as the
// auth storage, processLock to serialise refreshes, and auto refresh only while the app is
// in the foreground. Encrypting the session (SecureStore + aes-js) is deliberately not done:
// the anonymous session only guards the person's own rows and RLS holds the line.
export const supabase = createClient(url, clePubliable, {
  auth: {
    ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
})

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (etat) => {
    if (etat === 'active') {
      void supabase.auth.startAutoRefresh()
    } else {
      void supabase.auth.stopAutoRefresh()
    }
  })
}

let promesseConnexion: Promise<Session | null> | null = null

/**
 * Returns the current session, creating an anonymous one on the first launch (decision 5:
 * the diagnostic happens before any account). Safe to call several times: the sign-in
 * runs at most once per process.
 */
export function connecterAnonymement(): Promise<Session | null> {
  if (!promesseConnexion) {
    promesseConnexion = (async () => {
      const { data, error } = await supabase.auth.getSession()
      if (error) throw error
      if (data.session) return data.session
      const anonyme = await supabase.auth.signInAnonymously()
      if (anonyme.error) throw anonyme.error
      return anonyme.data.session
    })().catch((erreur: unknown) => {
      // Allow a retry on the next call after a failure (offline first launch).
      promesseConnexion = null
      throw erreur
    })
  }
  return promesseConnexion
}

export type EtatSession = {
  session: Session | null
  /** True once the bootstrap has finished, with or without a session. */
  pret: boolean
  erreur: Error | null
  reessayer: () => void
}

const ContexteSession = createContext<EtatSession | null>(null)

export function FournisseurSession({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [pret, setPret] = useState(false)
  const [erreur, setErreur] = useState<Error | null>(null)
  const [essai, setEssai] = useState(0)

  useEffect(() => {
    let actif = true
    connecterAnonymement()
      .then((s) => {
        if (actif) setSession(s)
      })
      .catch((e: unknown) => {
        if (actif) setErreur(e instanceof Error ? e : new Error(String(e)))
      })
      .finally(() => {
        if (actif) setPret(true)
      })
    return () => {
      actif = false
    }
  }, [essai])

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_evenement, nouvelle) => {
      setSession(nouvelle)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const valeur = useMemo<EtatSession>(
    () => ({
      session,
      pret,
      erreur,
      // The reset happens here, in the event, so the effect only reacts to the retry counter.
      reessayer: () => {
        setPret(false)
        setErreur(null)
        setEssai((n) => n + 1)
      },
    }),
    [session, pret, erreur],
  )

  return <ContexteSession.Provider value={valeur}>{children}</ContexteSession.Provider>
}

export function useSession(): EtatSession {
  const contexte = useContext(ContexteSession)
  if (!contexte) throw new Error('useSession must be used inside FournisseurSession')
  return contexte
}
