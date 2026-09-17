/**
 * Table `analyses`: measures and transcript, the only thing kept from the voice.
 */
import { z } from 'zod'
import { MesuresSchema } from './mesures.js'
import { IsoTimestampSchema, UuidSchema } from './primitives.js'
import { FournisseurTranscriptionSchema, TranscriptionSchema } from './transcription.js'

/**
 * The six things chapter 11 blocks in the Arena. Politics, religion and ethics have no category
 * here and pass: the screening never flags a subject, only sexual content, harassment or threats,
 * hate, violence, self-harm and what is illegal.
 */
export const CATEGORIES_MODERATION = [
  'sexuel',
  'harcelement',
  'haine',
  'violence',
  'automutilation',
  'illicite',
] as const
export const CategorieModerationSchema = z.enum(CATEGORIES_MODERATION)
export type CategorieModeration = z.infer<typeof CategorieModerationSchema>

/**
 * `analyses.moderation`: the verdict of the automatic screening of the transcript, written with
 * the analysis of an Arena or duel take. Null for a private take, and when the screening did not
 * run. `publier_prise()` reads `signalee`: a flagged take waits for Rebecca, any other is live.
 */
export const ModerationTranscriptionSchema = z.object({
  version: z.literal(1),
  signalee: z.boolean(),
  categories: z.array(CategorieModerationSchema),
  fournisseur: z.string().min(1),
  evalue_le: IsoTimestampSchema,
})
export type ModerationTranscription = z.infer<typeof ModerationTranscriptionSchema>

/** A row of `analyses` as read back from the database. */
export const AnalyseSchema = z.object({
  tentative_id: UuidSchema,
  version_schema: z.int().min(1),
  mesures: MesuresSchema,
  transcription: TranscriptionSchema,
  fournisseur_transcription: FournisseurTranscriptionSchema,
  moderation: ModerationTranscriptionSchema.nullable(),
  cree_le: IsoTimestampSchema,
})
export type Analyse = z.output<typeof AnalyseSchema>

/** What the worker inserts (service role). `version_schema` follows `mesures.version`. */
export const NouvelleAnalyseSchema = z
  .object({
    tentative_id: UuidSchema,
    version_schema: z.int().min(1),
    mesures: MesuresSchema,
    transcription: TranscriptionSchema,
    fournisseur_transcription: FournisseurTranscriptionSchema,
    moderation: ModerationTranscriptionSchema.nullable().default(null),
  })
  .refine((analyse) => analyse.version_schema === analyse.mesures.version, {
    path: ['version_schema'],
    message: 'version_schema doit être égal à mesures.version',
  })
export type NouvelleAnalyse = z.output<typeof NouvelleAnalyseSchema>
