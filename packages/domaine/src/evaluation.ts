/**
 * Table `evaluations`: sub-scores and feedback fields computed from `analyses`
 * with the grid version active at that time. Never rescored.
 */
import { z } from 'zod'
import { arrondirCentiemes, IsoTimestampSchema, PgNumericSchema, UuidSchema } from './primitives.js'
import type { ResultatTentative } from './tentative.js'

/** `sous_notes`: `{ "<cle critere>": { "score": number, "max": number } }`. */
export const SousNoteSchema = z.object({
  score: z.number().min(0),
  max: z.number().min(0),
})
export type SousNote = z.infer<typeof SousNoteSchema>

export const SousNotesSchema = z.record(z.string(), SousNoteSchema)
export type SousNotes = z.infer<typeof SousNotesSchema>

/** Shared shape of `points_forts` and `axes_travail` entries. */
export const PointRemarquableSchema = z.object({
  critere: z.string().min(1),
  mesure: z.string().min(1),
  valeur: z.number(),
})
export type PointRemarquable = z.infer<typeof PointRemarquableSchema>

export const PointFortSchema = PointRemarquableSchema
export type PointFort = z.infer<typeof PointFortSchema>

export const AxeTravailSchema = PointRemarquableSchema
export type AxeTravail = z.infer<typeof AxeTravailSchema>

/** `exercice_court`: the short exercise proposed after a take. */
export const ExerciceCourtSchema = z.object({
  duree_s: z.number().positive(),
  consigne: z.string().min(1),
})
export type ExerciceCourt = z.infer<typeof ExerciceCourtSchema>

/**
 * `redaction`: French wording generated from the fields. Regenerable without
 * audio, never read by logic.
 */
export const RedactionSchema = z.object({
  accroche: z.string(),
  levier: z.object({
    titre: z.string(),
    explication: z.string(),
  }),
  note_mesures: z.string(),
  modele: z.string(),
  genere_le: IsoTimestampSchema,
})
export type Redaction = z.output<typeof RedactionSchema>

/**
 * What the model noticed and no criterion covers. It never enters the note: nothing was measured
 * against anything. It reaches the person anyway, because someone who says « euh » two hundred
 * times deserves to be told even when the grid is silent about filler words, and it is kept so
 * that the gaps in the grid can be read and the grid can grow from what the app actually hears.
 */
export const ObservationHorsGrilleSchema = z.object({
  /** A short handle, so the same remark can be counted across takes: `mots_bequilles`, `debit`. */
  sujet: z.string().min(1),
  /** What to say to the person, in French, in one sentence. */
  remarque: z.string().min(1),
})
export type ObservationHorsGrille = z.infer<typeof ObservationHorsGrilleSchema>

/** A row of `evaluations` as read back from the database. */
export const EvaluationSchema = z.object({
  tentative_id: UuidSchema,
  grille_id: UuidSchema.nullable(),
  version_grille: z.int().min(1).nullable(),
  sous_notes: SousNotesSchema,
  note_totale: PgNumericSchema.nullable(),
  note_mesure: PgNumericSchema.nullable(),
  note_jugement: PgNumericSchema.nullable(),
  hors_grille: z.array(ObservationHorsGrilleSchema),
  seuil_reussite: PgNumericSchema.nullable(),
  points_forts: z.array(PointFortSchema),
  axes_travail: z.array(AxeTravailSchema),
  exercice_court: ExerciceCourtSchema.nullable(),
  redaction: RedactionSchema.nullable(),
  cree_le: IsoTimestampSchema,
  modifie_le: IsoTimestampSchema.optional(),
})
export type Evaluation = z.output<typeof EvaluationSchema>

/** What the worker inserts (service role). Defaults match the column defaults. */
export const NouvelleEvaluationSchema = z.object({
  tentative_id: UuidSchema,
  grille_id: UuidSchema.nullable().default(null),
  version_grille: z.int().min(1).nullable().default(null),
  sous_notes: SousNotesSchema.default({}),
  note_totale: z.number().min(0).max(999.99).nullable().default(null),
  note_mesure: z.number().min(0).max(1).nullable().default(null),
  note_jugement: z.number().min(0).max(1).nullable().default(null),
  hors_grille: z.array(ObservationHorsGrilleSchema).default([]),
  seuil_reussite: z.number().min(0).max(999.99).nullable().default(null),
  points_forts: z.array(PointFortSchema).default([]),
  axes_travail: z.array(AxeTravailSchema).default([]),
  exercice_court: ExerciceCourtSchema.nullable().default(null),
  redaction: RedactionSchema.nullable().default(null),
})
export type NouvelleEvaluation = z.output<typeof NouvelleEvaluationSchema>
export type NouvelleEvaluationEntree = z.input<typeof NouvelleEvaluationSchema>

/** `note_totale` is the sum of the sub-scores, rounded to two decimals. */
export function calculerNoteTotale(sousNotes: SousNotes): number {
  let total = 0
  for (const sousNote of Object.values(sousNotes)) total += sousNote.score
  return arrondirCentiemes(total)
}

/** One of the two halves of a note, brought back to 0..1. Null when that half has no axis. */
export function partNormalisee(sousNotes: SousNotes, cles: readonly string[]): number | null {
  let score = 0
  let max = 0
  for (const cle of cles) {
    const sousNote = sousNotes[cle]
    if (!sousNote) continue
    score += sousNote.score
    max += sousNote.max
  }
  if (max <= 0) return null
  return Math.min(1, Math.max(0, score / max))
}

/**
 * The note, out of `noteMax`, from its two halves.
 *
 * The split is a setting and not an accident of how many axes sit in each group: adding a fifth
 * measured axis must not quietly move the balance. When one half has no axis at all, the other
 * carries the whole note, because a note out of thirty that silently became a note out of twenty
 * would fail every threshold for a reason nobody could see.
 */
export function composerNote(options: {
  mesure: number | null
  jugement: number | null
  poidsMesure: number
  poidsJugement: number
  noteMax: number
}): number | null {
  const { mesure, jugement, poidsMesure, poidsJugement, noteMax } = options
  if (mesure === null && jugement === null) return null
  if (mesure === null) return arrondirCentiemes((jugement ?? 0) * noteMax)
  if (jugement === null) return arrondirCentiemes(mesure * noteMax)
  const somme = poidsMesure + poidsJugement
  if (somme <= 0) return null
  const part = (mesure * poidsMesure + jugement * poidsJugement) / somme
  return arrondirCentiemes(part * noteMax)
}

/**
 * The outcome written into `tentatives.resultat` for a step: validated when
 * the total reaches the threshold. Null while there is no grid or no threshold.
 */
export function resultatEtape(
  noteTotale: number | null,
  seuilReussite: number | null,
): ResultatTentative | null {
  if (noteTotale === null || seuilReussite === null) return null
  return noteTotale >= seuilReussite ? 'etape_validee' : 'etape_echouee'
}
