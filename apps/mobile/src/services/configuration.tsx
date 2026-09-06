import { lireConfiguration, type Configuration } from '@leq/domaine'
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { EcranChargement, EcranErreur } from '@/components/EcransEtat'
import { t } from '@/i18n/fr'
import { CLES, ecrireBooleen, ecrireJson, lireBooleen, lireJson } from '@/services/stockage'
import { supabase, useSession } from '@/services/supabase'

// Rows of the two startup tables, exactly as docs/DATA-MODEL.md names them.
type LigneConfiguration = {
  cle: string
  valeur: unknown
  type: 'nombre' | 'texte' | 'booleen' | 'json'
}

type LigneDrapeau = {
  cle: 'arene' | 'duels' | 'face_a_face'
  actif: boolean
}

export type Drapeaux = Record<LigneDrapeau['cle'], boolean>

// Shipped off (DATA-MODEL, drapeaux): nothing appears until Rebecca turns it on.
export const DRAPEAUX_PAR_DEFAUT: Drapeaux = { arene: false, duels: false, face_a_face: false }

export const CLE_REQUETE_CONFIGURATION = ['configuration'] as const
export const CLE_REQUETE_DRAPEAUX = ['drapeaux'] as const

const CINQ_MINUTES = 5 * 60 * 1000

async function chargerConfiguration(): Promise<Configuration> {
  const { data, error } = await supabase.from('configuration').select('cle, valeur, type')
  if (error) throw error
  // lireConfiguration (packages/domaine) validates every seeded key with Zod and applies the
  // defaults of the contract for anything missing.
  return lireConfiguration(data as LigneConfiguration[])
}

export function lireDrapeaux(lignes: readonly LigneDrapeau[]): Drapeaux {
  const drapeaux: Drapeaux = { ...DRAPEAUX_PAR_DEFAUT }
  for (const ligne of lignes) {
    if (ligne.cle in drapeaux) drapeaux[ligne.cle] = ligne.actif === true
  }
  return drapeaux
}

async function chargerDrapeaux(): Promise<Drapeaux> {
  const { data, error } = await supabase.from('drapeaux').select('cle, actif')
  if (error) throw error
  return lireDrapeaux(data as LigneDrapeau[])
}

export function useConfiguration(): UseQueryResult<Configuration> {
  const { pret, session } = useSession()
  return useQuery({
    queryKey: CLE_REQUETE_CONFIGURATION,
    queryFn: chargerConfiguration,
    enabled: pret && session !== null,
    staleTime: CINQ_MINUTES,
  })
}

export function useDrapeaux(): UseQueryResult<Drapeaux> {
  const { pret, session } = useSession()
  return useQuery({
    queryKey: CLE_REQUETE_DRAPEAUX,
    queryFn: chargerDrapeaux,
    enabled: pret && session !== null,
    staleTime: CINQ_MINUTES,
  })
}

type ContexteDemarrage = {
  /** False on the very first launch: the app routes to /accueil/bienvenue. */
  accueilTermine: boolean
  marquerAccueilTermine: () => void
}

const Contexte = createContext<ContexteDemarrage | null>(null)

/**
 * Startup gate. Reads the last good configuration and flags from the phone, hydrates the
 * query cache with them (marked stale so they refresh in the background), then renders the
 * shell. The shell is blocked, behind Bulle, only when there is nothing cached yet.
 */
export function FournisseurDemarrage({ children }: { children: ReactNode }) {
  const clientRequetes = useQueryClient()
  const sessionEtat = useSession()
  const [hydrate, setHydrate] = useState(false)
  const [accueilTermine, setAccueilTermine] = useState(false)

  useEffect(() => {
    let actif = true
    void Promise.all([
      lireJson<Configuration>(CLES.cacheConfiguration),
      lireJson<Drapeaux>(CLES.cacheDrapeaux),
      lireBooleen(CLES.accueilTermine),
    ]).then(([configuration, drapeaux, termine]) => {
      if (!actif) return
      if (configuration) {
        clientRequetes.setQueryData(CLE_REQUETE_CONFIGURATION, configuration, { updatedAt: 0 })
      }
      if (drapeaux) {
        clientRequetes.setQueryData(CLE_REQUETE_DRAPEAUX, lireDrapeaux(enLignes(drapeaux)), {
          updatedAt: 0,
        })
      }
      setAccueilTermine(termine)
      setHydrate(true)
    })
    return () => {
      actif = false
    }
  }, [clientRequetes])

  const configuration = useConfiguration()
  const drapeaux = useDrapeaux()

  useEffect(() => {
    if (configuration.data) void ecrireJson(CLES.cacheConfiguration, configuration.data)
  }, [configuration.data])

  useEffect(() => {
    if (drapeaux.data) void ecrireJson(CLES.cacheDrapeaux, drapeaux.data)
  }, [drapeaux.data])

  const valeur = useMemo<ContexteDemarrage>(
    () => ({
      accueilTermine,
      marquerAccueilTermine: () => {
        setAccueilTermine(true)
        void ecrireBooleen(CLES.accueilTermine, true)
      },
    }),
    [accueilTermine],
  )

  if (!hydrate || !sessionEtat.pret) return null

  const premierChargement = configuration.data === undefined
  if (premierChargement) {
    if (sessionEtat.erreur) {
      return <EcranErreur message={t('erreurs.session')} reessayer={sessionEtat.reessayer} />
    }
    if (configuration.isError) {
      return (
        <EcranErreur
          message={t('erreurs.configuration')}
          reessayer={() => {
            void configuration.refetch()
            void drapeaux.refetch()
          }}
        />
      )
    }
    return <EcranChargement />
  }

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>
}

function enLignes(drapeaux: Drapeaux): LigneDrapeau[] {
  return (Object.keys(DRAPEAUX_PAR_DEFAUT) as LigneDrapeau['cle'][]).map((cle) => ({
    cle,
    actif: drapeaux[cle] === true,
  }))
}

export function useDemarrage(): ContexteDemarrage {
  const contexte = useContext(Contexte)
  if (!contexte) throw new Error('useDemarrage must be used inside FournisseurDemarrage')
  return contexte
}
