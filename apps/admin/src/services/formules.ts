import { z } from 'zod'
import { FormuleDetailSchema, type FormuleDetail } from '@leq/domaine'
import { supabase } from './supabase'

export const cleRequeteFormules = ['formules'] as const

const COLONNES =
  'cle, nom, ordre, etapes_par_jour, debats_par_mois, duree_debat_s, acces_communaute, produit_store, actif'

export async function chargerFormules(): Promise<FormuleDetail[]> {
  const { data, error } = await supabase.from('formules').select(COLONNES).order('ordre')
  if (error) throw new Error(error.message)
  return z.array(FormuleDetailSchema).parse(data)
}

export async function creerFormule(valeur: FormuleDetail): Promise<FormuleDetail> {
  const { data, error } = await supabase.from('formules').insert(valeur).select(COLONNES).single()
  if (error) throw new Error(error.message)
  return FormuleDetailSchema.parse(data)
}

export type ModificationFormule = { cle: string; valeur: Omit<FormuleDetail, 'cle'> }

export async function modifierFormule(modification: ModificationFormule): Promise<void> {
  const { data, error } = await supabase
    .from('formules')
    .update(modification.valeur)
    .eq('cle', modification.cle)
    .select('cle')
  if (error) throw new Error(error.message)
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(
      'Aucune ligne modifiée pour cette formule. Vérifie le rôle admin dans le jeton et les règles RLS.',
    )
  }
}
