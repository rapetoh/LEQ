/**
 * Table `analyses`: measures and transcript, the only thing kept from the voice.
 */
import { z } from 'zod'
import { MesuresSchema } from './mesures.js'
import { IsoTimestampSchema, UuidSchema } from './primitives.js'
import { FournisseurTranscriptionSchema, TranscriptionSchema } from './transcription.js'

/** A row of `analyses` as read back from the database. */
export const AnalyseSchema = z.object({
  tentative_id: UuidSchema,
  version_schema: z.int().min(1),
  mesures: MesuresSchema,
  transcription: TranscriptionSchema,
  fournisseur_transcription: FournisseurTranscriptionSchema,
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
  })
  .refine((analyse) => analyse.version_schema === analyse.mesures.version, {
    path: ['version_schema'],
    message: 'version_schema doit être égal à mesures.version',
  })
export type NouvelleAnalyse = z.output<typeof NouvelleAnalyseSchema>
