import { z } from 'zod'
import {
  EchangeRecompenseSchema,
  RecompenseSchema,
  type EchangeRecompense,
  type Recompense,
  type RecompenseEditable,
  type StatutEchange,
} from '@leq/domaine'
import { supabase } from './supabase'

export const cleRequeteRecompenses = ['recompenses'] as const
export const cleRequeteEchanges = ['echanges_recompenses'] as const

function exigerLigne(data: unknown, quoi: string): void {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(
      `Aucune ligne modifiée pour ${quoi}. Vérifie le rôle admin dans le jeton et les règles RLS.`,
    )
  }
}

export async function chargerRecompenses(): Promise<Recompense[]> {
  const { data, error } = await supabase.from('recompenses').select('*').order('ordre')
  if (error) throw new Error(error.message)
  return z.array(RecompenseSchema).parse(data)
}

export async function creerRecompense(valeur: RecompenseEditable): Promise<Recompense> {
  const { data, error } = await supabase.from('recompenses').insert(valeur).select('*').single()
  if (error) throw new Error(error.message)
  return RecompenseSchema.parse(data)
}

export type ModificationRecompense = { id: string; valeur: Partial<RecompenseEditable> }

export async function modifierRecompense(modification: ModificationRecompense): Promise<void> {
  const { data, error } = await supabase
    .from('recompenses')
    .update(modification.valeur)
    .eq('id', modification.id)
    .select('id')
  if (error) throw new Error(error.message)
  exigerLigne(data, 'cette récompense')
}

/** An exchange with the reward's title and the person's e-mail, for Rebecca to honour it. */
export type EchangeAdmin = EchangeRecompense & {
  titre: string
  email: string | null
  prenom: string | null
}

const LigneEchangeSchema = EchangeRecompenseSchema.extend({
  recompenses: z.object({ titre: z.string() }).nullable(),
  profils: z.object({ prenom: z.string().nullable() }).nullable(),
})

export async function chargerEchanges(): Promise<EchangeAdmin[]> {
  const { data, error } = await supabase
    .from('echanges_recompenses')
    .select('*, recompenses(titre), profils(prenom)')
    .order('cree_le', { ascending: false })
  if (error) throw new Error(error.message)
  const lignes = z.array(LigneEchangeSchema).parse(data)
  // The e-mail lives in auth.users: the admin reads it through the RPC below, per exchange.
  return lignes.map(({ recompenses, profils, ...echange }) => ({
    ...echange,
    titre: recompenses?.titre ?? '',
    prenom: profils?.prenom ?? null,
    email: null,
  }))
}

export type TraitementEchange = { id: string; statut: StatutEchange; note?: string }

export async function traiterEchange(traitement: TraitementEchange): Promise<void> {
  const { error } = await supabase.rpc('traiter_echange', {
    p_echange: traitement.id,
    p_statut: traitement.statut,
    p_note: traitement.note ?? null,
  })
  if (error) throw new Error(error.message)
}
