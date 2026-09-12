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
  image_chemin: z.string().nullable(),
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
  image_chemin: z.string().nullable(),
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
  image_chemin: z.string().nullable(),
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

/**
 * The bucket holding what Rebecca publishes: the picture of a workshop, of an announcement, of a
 * reward. Public by design, unlike every other bucket in LEQ: these images are what the
 * application shows to everyone it invites, and they hold nothing personal.
 */
export const BUCKET_MEDIAS = 'medias'
export const TAILLE_MAX_MEDIA_OCTETS = 5 * 1024 * 1024
export const TYPES_MEDIA_ACCEPTES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const

/** Why an image was refused, in the terms the admin shows. */
export type RefusMedia = 'type' | 'taille'

export function verifierMedia(fichier: { type: string; size: number }): RefusMedia | null {
  if (!(TYPES_MEDIA_ACCEPTES as readonly string[]).includes(fichier.type)) return 'type'
  if (fichier.size > TAILLE_MAX_MEDIA_OCTETS) return 'taille'
  return null
}

/** Public URL of a stored image. The row keeps the path; the host is never written down. */
export function urlMedia(urlSupabase: string, chemin: string | null): string | null {
  if (!chemin) return null
  return `${urlSupabase.replace(/\/$/, '')}/storage/v1/object/public/${BUCKET_MEDIAS}/${chemin}`
}

/**
 * Where an image lives inside the bucket: one folder per kind, a random name, the original
 * extension. Never the uploaded file name, which carries whatever was on someone's disk.
 */
export function cheminMedia(
  usage: 'ateliers' | 'annonces' | 'recompenses',
  identifiant: string,
  typeMime: string,
): string {
  const extension = typeMime === 'image/jpeg' ? 'jpg' : typeMime.replace('image/', '')
  return `${usage}/${identifiant}.${extension}`
}
