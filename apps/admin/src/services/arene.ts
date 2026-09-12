import { z } from 'zod'
import {
  PrisePubliqueSchema,
  SujetAreneSchema,
  TheseSchema,
  type PrisePublique,
  type SujetArene,
  type SujetAreneEditable,
  type These,
  type TheseEditable,
} from '@leq/domaine'
import { supabase } from './supabase'

export const cleRequeteSujets = ['sujets_arene'] as const
export const cleRequeteModeration = ['moderation'] as const

function exigerLigne(data: unknown, quoi: string): void {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(
      `Aucune ligne modifiée pour ${quoi}. Vérifie le rôle admin dans le jeton et les règles RLS.`,
    )
  }
}

export async function chargerSujets(): Promise<SujetArene[]> {
  const { data, error } = await supabase.from('sujets_arene').select('*').order('ordre')
  if (error) throw new Error(error.message)
  return z.array(SujetAreneSchema).parse(data)
}

export async function creerSujet(valeur: SujetAreneEditable): Promise<SujetArene> {
  const { data, error } = await supabase.from('sujets_arene').insert(valeur).select('*').single()
  if (error) throw new Error(error.message)
  return SujetAreneSchema.parse(data)
}

export type ModificationSujet = { id: string; valeur: Partial<SujetAreneEditable> }

export async function modifierSujet(modification: ModificationSujet): Promise<void> {
  const { data, error } = await supabase
    .from('sujets_arene')
    .update(modification.valeur)
    .eq('id', modification.id)
    .select('id')
  if (error) throw new Error(error.message)
  exigerLigne(data, 'ce sujet')
}

/** A public take as the moderation queue shows it, with its subject or duel. */
export type PriseAModerer = PrisePublique & { sujet: string | null }

const LigneModerationSchema = PrisePubliqueSchema.extend({
  sujets_arene: z.object({ texte: z.string() }).nullable(),
  duels: z.object({ sujet: z.string() }).nullable(),
})

export async function chargerModeration(): Promise<PriseAModerer[]> {
  const { data, error } = await supabase
    .from('prises_publiques')
    .select('*, sujets_arene(texte), duels(sujet)')
    .order('cree_le', { ascending: false })
    .limit(200)
  if (error) throw new Error(error.message)
  return z
    .array(LigneModerationSchema)
    .parse(data)
    .map(({ sujets_arene, duels, ...prise }) => ({
      ...prise,
      sujet: sujets_arene?.texte ?? duels?.sujet ?? null,
    }))
}

export async function modererPrise(
  id: string,
  decision: 'publiee' | 'retiree',
  motif?: string,
): Promise<void> {
  const { error } = await supabase.rpc('moderer_prise', {
    p_prise: id,
    p_decision: decision,
    p_motif: motif ?? null,
  })
  if (error) throw new Error(error.message)
}

// --------------------------------------------------------------------------------------------
// The thesis bank of the face-à-face (Phase 8)
// --------------------------------------------------------------------------------------------

export const cleRequeteTheses = ['theses'] as const

export async function chargerTheses(): Promise<These[]> {
  const { data, error } = await supabase.from('theses').select('*').order('ordre')
  if (error) throw new Error(error.message)
  return z.array(TheseSchema).parse(data)
}

export async function creerThese(valeur: TheseEditable): Promise<These> {
  const { data, error } = await supabase.from('theses').insert(valeur).select('*').single()
  if (error) throw new Error(error.message)
  return TheseSchema.parse(data)
}

export type ModificationThese = { id: string; valeur: Partial<TheseEditable> }

export async function modifierThese(modification: ModificationThese): Promise<void> {
  const { data, error } = await supabase
    .from('theses')
    .update(modification.valeur)
    .eq('id', modification.id)
    .select('id')
  if (error) throw new Error(error.message)
  exigerLigne(data, 'cette thèse')
}
