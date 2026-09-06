// Rebecca's workshops and announcements on the phone (B1 card, B1b, F1), and the state of
// the account (suspended or not). Read-only: the admin writes, the worker sends.
import { AnnonceSchema, AtelierSchema, type Annonce, type Atelier } from '@leq/domaine'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { z } from 'zod'

import { supabase, useSession } from './supabase'

export const CLE_ATELIERS = ['ateliers'] as const
export const CLE_ANNONCES = ['annonces'] as const
export const CLE_SUSPENSION = ['suspension'] as const

/** Published workshops that have not started yet, soonest first. */
export async function chargerAteliers(): Promise<Atelier[]> {
  const { data, error } = await supabase
    .from('ateliers')
    .select('*')
    .eq('publie', true)
    .gte('date_debut', new Date().toISOString())
    .order('date_debut')
  if (error) throw new Error(error.message)
  return z.array(AtelierSchema).parse(data)
}

export async function chargerAnnonces(): Promise<Annonce[]> {
  const { data, error } = await supabase
    .from('annonces')
    .select('*')
    .order('envoyee_le', { ascending: false })
    .limit(20)
  if (error) throw new Error(error.message)
  return z.array(AnnonceSchema).parse(data)
}

function useRequete<T>(cle: readonly string[], charger: () => Promise<T>): UseQueryResult<T> {
  const { pret, session } = useSession()
  return useQuery({
    queryKey: cle,
    queryFn: charger,
    enabled: pret && session !== null,
    staleTime: 5 * 60_000,
  })
}

export const useAteliers = () => useRequete(CLE_ATELIERS, chargerAteliers)
export const useAnnonces = () => useRequete(CLE_ANNONCES, chargerAnnonces)

/** Whether the signed-in account is suspended (chapter 8), read from the person's own profile. */
export async function chargerSuspension(): Promise<boolean> {
  const { data, error } = await supabase.rpc('est_suspendu')
  if (error) throw new Error(error.message)
  return z.boolean().parse(data)
}

export const useSuspension = () => useRequete(CLE_SUSPENSION, chargerSuspension)

/** "Lyon · 12 septembre" or "En ligne · 12 septembre", for the cards. */
export function lieuEtDate(atelier: Pick<Atelier, 'lieu' | 'en_ligne' | 'date_debut'>): string {
  const date = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(
    new Date(atelier.date_debut),
  )
  return `${atelier.en_ligne ? 'En ligne' : atelier.lieu} · ${date}`
}
