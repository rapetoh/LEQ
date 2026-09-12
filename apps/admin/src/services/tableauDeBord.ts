import { z } from 'zod'

import { supabase } from './supabase'

export const cleRequeteTableau = ['tableau_de_bord'] as const

/** What `tableau_de_bord()` answers. Validated here, so a shape change fails loudly. */
export const TableauSchema = z.object({
  a_traiter: z.object({
    moderation: z.number().int().min(0),
    echanges: z.number().int().min(0),
    demandes_donnees: z.number().int().min(0),
  }),
  semaine: z.object({
    prises: z.number().int().min(0),
    personnes: z.number().int().min(0),
    defis_valides: z.number().int().min(0),
    comptes: z.number().int().min(0),
  }),
  etat: z.object({
    drapeaux: z.record(z.string(), z.boolean()),
    sujet_arene: z.object({ texte: z.string(), jour: z.number().int() }).nullable(),
    annonces_ce_mois: z.number().int().min(0),
    plafond_annonces: z.number().int().min(0),
    grille_publiee: z.boolean(),
  }),
  a_ecrire: z.object({
    defis: z.number().int().min(0),
    exercices: z.number().int().min(0),
    recompenses: z.number().int().min(0),
    sujets_arene: z.number().int().min(0),
    theses: z.number().int().min(0),
  }),
})
export type Tableau = z.output<typeof TableauSchema>

export async function chargerTableau(): Promise<Tableau> {
  const { data, error } = await supabase.rpc('tableau_de_bord')
  if (error) throw new Error(error.message)
  return TableauSchema.parse(data)
}
