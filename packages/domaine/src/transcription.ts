/**
 * `analyses.transcription`: the timed transcript kept from the voice.
 */
import { z } from 'zod'

export const MotTranscritSchema = z
  .object({
    mot: z.string().min(1),
    debut_s: z.number().min(0),
    fin_s: z.number().min(0),
    confiance: z.number().min(0).max(1),
  })
  .refine((mot) => mot.fin_s >= mot.debut_s, {
    path: ['fin_s'],
    message: 'fin_s doit être supérieur ou égal à debut_s',
  })
export type MotTranscrit = z.infer<typeof MotTranscritSchema>

export const TranscriptionSchema = z.object({
  texte: z.string(),
  mots: z.array(MotTranscritSchema),
})
export type Transcription = z.infer<typeof TranscriptionSchema>

/** `analyses.fournisseur_transcription`: 'stub' until the Phase 2 bench decides. */
export const FOURNISSEUR_TRANSCRIPTION_STUB = 'stub'
export const FournisseurTranscriptionSchema = z.string().min(1).max(64)
export type FournisseurTranscription = z.infer<typeof FournisseurTranscriptionSchema>

/** A transcript with no speech at all, what the stub returns and what a silent take yields. */
export const TRANSCRIPTION_VIDE: Transcription = { texte: '', mots: [] }
