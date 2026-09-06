import { z } from 'zod'
import {
  EntreeConfigurationSchema,
  normaliserEntreeConfiguration,
  type EntreeConfiguration,
} from '../modele/configuration'
import { supabase } from './supabase'

export const cleRequeteConfiguration = ['configuration'] as const

export async function chargerConfiguration(): Promise<EntreeConfiguration[]> {
  const { data, error } = await supabase
    .from('configuration')
    .select('cle, valeur, type, description, modifie_le')
    .order('cle', { ascending: true })

  if (error) throw new Error(error.message)
  return z.array(EntreeConfigurationSchema).parse(data).map(normaliserEntreeConfiguration)
}

export type ModificationConfiguration = {
  cle: string
  valeur: unknown
  /** auth.uid() of the person saving, written to `modifie_par`. */
  modifiePar: string
}

/**
 * Updates one row. RLS only lets the admin role through; when the policy rejects the write,
 * PostgREST answers with zero rows rather than an error, so an empty result is treated as a failure.
 */
export async function enregistrerConfiguration(
  modification: ModificationConfiguration,
): Promise<void> {
  const { data, error } = await supabase
    .from('configuration')
    .update({ valeur: modification.valeur, modifie_par: modification.modifiePar })
    .eq('cle', modification.cle)
    .select('cle')

  if (error) throw new Error(error.message)
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(
      `Aucune ligne modifiée pour ${modification.cle}. Vérifie le rôle admin dans le jeton et les règles RLS.`,
    )
  }
}
