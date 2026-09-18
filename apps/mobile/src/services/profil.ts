// The person's own profile row, shared by the screens that greet them (B1, G1), and the last
// analysed take, which is what the Moi tab shows as the speaker's identity until Rebecca's
// archetypes exist.
import { MesuresSchema, type Mesures } from '@leq/domaine'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'

import { supabase, useSession } from './supabase'

export const CLE_PROFIL_LECTURE = ['profil_lecture'] as const

export type ProfilLecture = {
  prenom: string | null
  avatar_chemin: string | null
  cree_le: string
  /** Réglages, and the moment of publishing: the name and the picture on a public passage. */
  publier_sous_prenom: boolean
}

export function useProfil(): UseQueryResult<ProfilLecture | null> {
  const { pret, session } = useSession()
  return useQuery({
    queryKey: CLE_PROFIL_LECTURE,
    enabled: pret && session !== null,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ProfilLecture | null> => {
      const { data, error } = await supabase
        .from('profils')
        .select('prenom, avatar_chemin, cree_le, publier_sous_prenom')
        .eq('id', session?.user.id)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return (data as ProfilLecture | null) ?? null
    },
  })
}

/** "juin 2026" for "Depuis juin 2026". */
/** Writes the choice of publishing under one's first name and picture (Réglages, and C2). */
export async function definirPublierSousPrenom(valeur: boolean): Promise<void> {
  const { data: session } = await supabase.auth.getSession()
  const uid = session.session?.user.id
  if (!uid) throw new Error('not signed in')
  const { error } = await supabase
    .from('profils')
    .update({ publier_sous_prenom: valeur })
    .eq('id', uid)
  if (error) throw new Error(error.message)
}

export function moisEtAnnee(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(iso))
}

export const CLE_DERNIERE_MESURE = ['derniere_mesure'] as const

export interface DerniereMesure {
  tentative_id: string
  enregistre_le: string
  mesures: Mesures
}

/** The most recent take that has its feedback, with its measures. Null before the first one. */
export function useDerniereMesure(): UseQueryResult<DerniereMesure | null> {
  const { pret, session } = useSession()
  return useQuery({
    queryKey: CLE_DERNIERE_MESURE,
    enabled: pret && session !== null,
    staleTime: 60_000,
    queryFn: async (): Promise<DerniereMesure | null> => {
      const { data, error } = await supabase
        .from('tentatives')
        .select('id, enregistre_le, analyses(mesures)')
        .eq('utilisateur_id', session?.user.id)
        .eq('statut', 'retour_disponible')
        .order('enregistre_le', { ascending: false })
        .limit(1)
      if (error) throw new Error(error.message)
      const ligne = (data ?? [])[0] as
        { id: string; enregistre_le: string; analyses: unknown } | undefined
      if (!ligne) return null
      const brut = Array.isArray(ligne.analyses) ? ligne.analyses[0] : ligne.analyses
      const lu = MesuresSchema.safeParse((brut as { mesures?: unknown } | null)?.mesures)
      if (!lu.success) return null
      return { tentative_id: ligne.id, enregistre_le: ligne.enregistre_le, mesures: lu.data }
    },
  })
}

export type FournisseurConnexion = 'apple' | 'google' | 'email'

/** How the person signed in, from what Supabase kept of the identity. */
export function fournisseurDeConnexion(session: Session | null): FournisseurConnexion {
  const fournisseur = (session?.user.app_metadata as { provider?: string } | undefined)?.provider
  if (fournisseur === 'apple' || fournisseur === 'google') return fournisseur
  return 'email'
}

/** Apple hides the address behind a relay; showing it would show a code, not a person. */
export function adresseMasquee(email: string | null): boolean {
  return email !== null && /@privaterelay\.appleid\.com$/i.test(email)
}
