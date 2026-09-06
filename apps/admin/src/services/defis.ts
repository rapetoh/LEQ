import { z } from 'zod'
import {
  DefiSchema,
  ExerciceSchema,
  ModeleActeSchema,
  type Defi,
  type DefiEditable,
  type Exercice,
  type ExerciceEditable,
  type ModeleActe,
} from '@leq/domaine'
import { supabase } from './supabase'

// The banks, as the admin reads and writes them. RLS lets only the admin role write; a
// refused write comes back as zero rows, so an empty result is treated as a failure.

export const cleRequeteActes = ['modeles_actes'] as const
export const cleRequeteDefis = ['defis'] as const
export const cleRequeteExercices = ['exercices'] as const

function exigerLigne(data: unknown, quoi: string): void {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(
      `Aucune ligne modifiée pour ${quoi}. Vérifie le rôle admin dans le jeton et les règles RLS.`,
    )
  }
}

export async function chargerModelesActes(): Promise<ModeleActe[]> {
  const { data, error } = await supabase.from('modeles_actes').select('*').order('ordre')
  if (error) throw new Error(error.message)
  return z.array(ModeleActeSchema).parse(data)
}

export type ModeleActeEditable = { ordre: number; titre: string; sous_titre: string | null }

/** Creates or renames an act model. The order is the key: it never changes here. */
export async function enregistrerModeleActe(acte: ModeleActeEditable): Promise<void> {
  const { data, error } = await supabase
    .from('modeles_actes')
    .upsert(acte, { onConflict: 'ordre' })
    .select('ordre')
  if (error) throw new Error(error.message)
  exigerLigne(data, `l'acte ${acte.ordre}`)
}

/** Every défi, active or not: the admin sees the whole bank. */
export async function chargerDefis(): Promise<Defi[]> {
  const { data, error } = await supabase
    .from('defis')
    .select('*')
    .order('ordre_acte')
    .order('ordre')
  if (error) throw new Error(error.message)
  return z.array(DefiSchema).parse(data)
}

export async function creerDefi(valeur: DefiEditable): Promise<Defi> {
  const { data, error } = await supabase.from('defis').insert(valeur).select('*').single()
  if (error) throw new Error(error.message)
  return DefiSchema.parse(data)
}

export type ModificationDefi = { id: string; valeur: Partial<DefiEditable> }

export async function modifierDefi(modification: ModificationDefi): Promise<void> {
  const { data, error } = await supabase
    .from('defis')
    .update(modification.valeur)
    .eq('id', modification.id)
    .select('id')
  if (error) throw new Error(error.message)
  exigerLigne(data, 'ce défi')
}

/** Swaps the order of two défis of the same act, atomically, through the database function. */
export async function echangerOrdreDefis(a: string, b: string): Promise<void> {
  const { error } = await supabase.rpc('echanger_ordre_defis', { p_a: a, p_b: b })
  if (error) throw new Error(error.message)
}

export async function chargerExercices(): Promise<Exercice[]> {
  const { data, error } = await supabase
    .from('exercices')
    .select('*')
    .order('competence')
    .order('cle')
  if (error) throw new Error(error.message)
  return z.array(ExerciceSchema).parse(data)
}

export async function creerExercice(valeur: ExerciceEditable): Promise<Exercice> {
  const { data, error } = await supabase.from('exercices').insert(valeur).select('*').single()
  if (error) throw new Error(error.message)
  return ExerciceSchema.parse(data)
}

export type ModificationExercice = { id: string; valeur: Partial<ExerciceEditable> }

export async function modifierExercice(modification: ModificationExercice): Promise<void> {
  const { data, error } = await supabase
    .from('exercices')
    .update(modification.valeur)
    .eq('id', modification.id)
    .select('id')
  if (error) throw new Error(error.message)
  exigerLigne(data, 'cet exercice')
}
