import { z } from 'zod'
import {
  CritereGrilleSchema,
  IsoTimestampSchema,
  UuidSchema,
  type CritereGrille,
} from '@leq/domaine'
import type { CritereEditable } from '../modele/grille'
import { supabase } from './supabase'

export const cleRequeteGrilles = ['grilles'] as const

export const GrilleSchema = z.object({
  id: UuidSchema,
  version: z.int(),
  publiee_le: IsoTimestampSchema.nullable(),
  notes: z.string().nullable(),
  cree_le: IsoTimestampSchema,
  modifie_le: IsoTimestampSchema,
})
export type Grille = z.output<typeof GrilleSchema>
export type GrilleAvecCriteres = Grille & { criteres: CritereGrille[] }

function exigerLigne(data: unknown, quoi: string): void {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(
      `Aucune ligne modifiée pour ${quoi}. Vérifie le rôle admin dans le jeton et les règles RLS.`,
    )
  }
}

export async function chargerGrilles(): Promise<GrilleAvecCriteres[]> {
  const [grilles, criteres] = await Promise.all([
    supabase
      .from('grilles')
      .select('id, version, publiee_le, notes, cree_le, modifie_le')
      .order('version', { ascending: false }),
    supabase.from('criteres_grille').select('*').order('ordre'),
  ])
  if (grilles.error) throw new Error(grilles.error.message)
  if (criteres.error) throw new Error(criteres.error.message)
  const lignes = z.array(CritereGrilleSchema).parse(criteres.data)
  return z
    .array(GrilleSchema)
    .parse(grilles.data)
    .map((grille) => ({
      ...grille,
      criteres: lignes.filter((c) => c.grille_id === grille.id),
    }))
}

/** A new draft version, copied from another version when one is given. */
export async function creerVersion(options: {
  depuis: GrilleAvecCriteres | null
  notes: string | null
  creePar: string
}): Promise<Grille> {
  const { data: derniere } = await supabase
    .from('grilles')
    .select('version')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  const version = ((derniere as { version?: number } | null)?.version ?? 0) + 1
  const { data, error } = await supabase
    .from('grilles')
    .insert({ version, notes: options.notes, cree_par: options.creePar })
    .select('id, version, publiee_le, notes, cree_le, modifie_le')
    .single()
  if (error) throw new Error(error.message)
  const grille = GrilleSchema.parse(data)
  if (options.depuis && options.depuis.criteres.length > 0) {
    const copies = options.depuis.criteres.map((c) => ({
      grille_id: grille.id,
      cle: c.cle,
      nom: c.nom,
      definition: c.definition,
      // A judged axis without its worked examples cannot be published, so a new version that
      // dropped them would silently become unpublishable.
      source: c.source,
      exemple_cinq: c.exemple_cinq,
      exemple_deux: c.exemple_deux,
      regle: c.regle,
      ordre: c.ordre,
    }))
    const copie = await supabase.from('criteres_grille').insert(copies)
    if (copie.error) throw new Error(copie.error.message)
  }
  return grille
}

export async function creerCritere(grilleId: string, valeur: CritereEditable): Promise<void> {
  const { error } = await supabase
    .from('criteres_grille')
    .insert({ grille_id: grilleId, ...valeur })
  if (error) throw new Error(error.message)
}

export async function modifierCritere(id: string, valeur: CritereEditable): Promise<void> {
  const { data, error } = await supabase
    .from('criteres_grille')
    .update(valeur)
    .eq('id', id)
    .select('id')
  if (error) throw new Error(error.message)
  exigerLigne(data, 'ce critère')
}

export async function supprimerCritere(id: string): Promise<void> {
  const { data, error } = await supabase.from('criteres_grille').delete().eq('id', id).select('id')
  if (error) throw new Error(error.message)
  exigerLigne(data, 'ce critère')
}

/**
 * Publishing is one-way: the worker uses the most recent published version from then on. It goes
 * through the database function, which refuses a grid whose judged axes carry no worked examples.
 * Without them the model scores against its own idea of a good speaker and the same take drifts
 * from one week to the next.
 */
export async function publierGrille(id: string): Promise<void> {
  const { error } = await supabase.rpc('publier_grille', { p_grille: id })
  if (error) throw new Error(error.message)
}

export async function modifierNotesGrille(id: string, notes: string | null): Promise<void> {
  const { data, error } = await supabase.from('grilles').update({ notes }).eq('id', id).select('id')
  if (error) throw new Error(error.message)
  exigerLigne(data, 'cette grille')
}
