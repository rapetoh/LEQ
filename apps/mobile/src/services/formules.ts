import { FormuleDetailSchema, type FormuleDetail } from '@leq/domaine'
import { useQuery } from '@tanstack/react-query'

import { supabase } from './supabase'

// The tiers and what they give. They are rows now, so a third one is a setting and not a release
// (meeting of 12 September 2026), and the application has to read their names rather than hold a
// list of two.

export const CLE_FORMULES = ['formules'] as const

export function useFormules() {
  return useQuery({
    queryKey: CLE_FORMULES,
    queryFn: async (): Promise<FormuleDetail[]> => {
      const { data, error } = await supabase
        .from('formules')
        .select(
          'cle, nom, ordre, etapes_par_jour, debats_par_mois, duree_debat_s, acces_communaute, produit_store, actif',
        )
        .eq('actif', true)
        .order('ordre')
      if (error) throw new Error(error.message)
      return FormuleDetailSchema.array().parse(data ?? [])
    },
    staleTime: 5 * 60_000,
  })
}

/** The tier's name as Rebecca wrote it, or its key while the list is still loading. */
export function nomFormule(formules: readonly FormuleDetail[] | undefined, cle: string): string {
  return formules?.find((f) => f.cle === cle)?.nom ?? cle
}
