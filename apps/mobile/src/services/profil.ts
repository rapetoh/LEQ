// The person's own profile row, shared by the screens that greet them (B1, G1).
import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { supabase, useSession } from './supabase'

export const CLE_PROFIL_LECTURE = ['profil_lecture'] as const

export type ProfilLecture = { prenom: string | null; cree_le: string }

export function useProfil(): UseQueryResult<ProfilLecture | null> {
  const { pret, session } = useSession()
  return useQuery({
    queryKey: CLE_PROFIL_LECTURE,
    enabled: pret && session !== null,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ProfilLecture | null> => {
      const { data, error } = await supabase
        .from('profils')
        .select('prenom, cree_le')
        .eq('id', session?.user.id)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return (data as ProfilLecture | null) ?? null
    },
  })
}

/** "juin 2026" for "Depuis juin 2026". */
export function moisEtAnnee(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(iso))
}
