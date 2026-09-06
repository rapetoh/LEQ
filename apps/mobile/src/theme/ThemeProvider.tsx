import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'

import { CLES, lireJson, ecrireJson } from '@/services/stockage'
import { themeClair, themeSombre, type Theme } from '@/theme/tokens'

// "Mode nuit" of the Réglages screen (G3): automatique follows the phone.
export type ModeNuit = 'automatique' | 'clair' | 'sombre'

type ContexteTheme = {
  theme: Theme
  mode: ModeNuit
  definirMode: (mode: ModeNuit) => void
}

const Contexte = createContext<ContexteTheme | null>(null)

function estModeNuit(valeur: unknown): valeur is ModeNuit {
  return valeur === 'automatique' || valeur === 'clair' || valeur === 'sombre'
}

export function FournisseurTheme({ children }: { children: ReactNode }) {
  const schemaSysteme = useColorScheme()
  const [mode, setMode] = useState<ModeNuit>('automatique')

  useEffect(() => {
    let actif = true
    void lireJson<unknown>(CLES.modeNuit).then((valeur) => {
      if (actif && estModeNuit(valeur)) setMode(valeur)
    })
    return () => {
      actif = false
    }
  }, [])

  const valeur = useMemo<ContexteTheme>(() => {
    const sombre = mode === 'sombre' || (mode === 'automatique' && schemaSysteme === 'dark')
    return {
      theme: sombre ? themeSombre : themeClair,
      mode,
      definirMode: (nouveau) => {
        setMode(nouveau)
        void ecrireJson(CLES.modeNuit, nouveau)
      },
    }
  }, [mode, schemaSysteme])

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>
}

export function useTheme(): Theme {
  return useContexteTheme().theme
}

export function useContexteTheme(): ContexteTheme {
  const contexte = useContext(Contexte)
  if (!contexte) throw new Error('useTheme must be used inside FournisseurTheme')
  return contexte
}
