/**
 * Phase 6: Rebecca's workshops and announcements (cahier chapter 12), the suspension log
 * (chapter 8). The cap and the region filter are enforced by `publier_annonce()`.
 */
import { z } from 'zod'
import { IsoTimestampSchema, UuidSchema } from './primitives.js'
import { CodeRegionSchema } from './profil.js'

export const AtelierSchema = z.object({
  id: UuidSchema,
  titre: z.string().min(1),
  sous_titre: z.string().nullable(),
  description: z.string().nullable(),
  lieu: z.string().min(1),
  en_ligne: z.boolean(),
  region: CodeRegionSchema.nullable(),
  date_debut: IsoTimestampSchema,
  places: z.int().positive().nullable(),
  lien: z.string().nullable(),
  recompense_id: UuidSchema.nullable(),
  publie: z.boolean(),
  cree_par: UuidSchema.nullable(),
  cree_le: IsoTimestampSchema,
  modifie_le: IsoTimestampSchema,
})
export type Atelier = z.output<typeof AtelierSchema>
export const AtelierEditableSchema = AtelierSchema.omit({
  id: true,
  cree_par: true,
  cree_le: true,
  modifie_le: true,
})
export type AtelierEditable = z.output<typeof AtelierEditableSchema>

export const AnnonceSchema = z.object({
  id: UuidSchema,
  titre: z.string().min(1),
  corps: z.string().min(1),
  atelier_id: UuidSchema.nullable(),
  regions: z.array(CodeRegionSchema).nullable(),
  envoyee_le: IsoTimestampSchema,
  destinataires: z.int().min(0).nullable(),
  envoyes: z.int().min(0),
  echecs: z.int().min(0),
  cree_par: UuidSchema.nullable(),
  cree_le: IsoTimestampSchema,
})
export type Annonce = z.output<typeof AnnonceSchema>

/** What the admin sends to `publier_annonce()`. */
export const NouvelleAnnonceSchema = z.object({
  titre: z.string().trim().min(1).max(80),
  corps: z.string().trim().min(1).max(240),
  atelier_id: UuidSchema.nullable(),
  regions: z.array(CodeRegionSchema),
})
export type NouvelleAnnonce = z.output<typeof NouvelleAnnonceSchema>

export const REFUS_ANNONCE = ['plafond_annonces_atteint'] as const
export function lireRefusAnnonce(message: string): (typeof REFUS_ANNONCE)[number] | null {
  return REFUS_ANNONCE.find((refus) => message.includes(refus)) ?? null
}

export const SuspensionSchema = z.object({
  id: UuidSchema,
  utilisateur_id: UuidSchema,
  motif: z.string().min(1),
  cree_par: UuidSchema.nullable(),
  cree_le: IsoTimestampSchema,
  levee_le: IsoTimestampSchema.nullable(),
  levee_par: UuidSchema.nullable(),
})
export type Suspension = z.output<typeof SuspensionSchema>

/** The push sent by the worker for an announcement (X6): the title is Rebecca's, the body too. */
export const DONNEES_PUSH_ANNONCE = 'annonce_id' as const
