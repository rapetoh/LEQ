import { z } from 'zod'
import {
  EntreeDrapeauSchema,
  normaliserEntreeDrapeau,
  type EntreeDrapeau,
} from '../modele/drapeaux'
import { supabase } from './supabase'

export const cleRequeteDrapeaux = ['drapeaux'] as const

export async function chargerDrapeaux(): Promise<EntreeDrapeau[]> {
  const { data, error } = await supabase
    .from('drapeaux')
    .select('cle, actif, modifie_le')
    .order('cle', { ascending: true })

  if (error) throw new Error(error.message)
  return z.array(EntreeDrapeauSchema).parse(data).map(normaliserEntreeDrapeau)
}

export type ModificationDrapeau = {
  cle: string
  actif: boolean
  /** auth.uid() of the person saving, written to `modifie_par`. */
  modifiePar: string
}

export async function enregistrerDrapeau(modification: ModificationDrapeau): Promise<void> {
  const { data, error } = await supabase
    .from('drapeaux')
    .update({ actif: modification.actif, modifie_par: modification.modifiePar })
    .eq('cle', modification.cle)
    .select('cle')

  if (error) throw new Error(error.message)
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(
      `Aucune ligne modifiée pour ${modification.cle}. Vérifie le rôle admin dans le jeton et les règles RLS.`,
    )
  }
}
