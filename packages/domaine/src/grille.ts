/**
 * Tables `grilles` and `criteres_grille`: Rebecca's grid, versioned, and the
 * pure engine that scores a criterion rule against the measures.
 *
 * Rule v1: `{ version: 1, score_max, elements: [{ mesure, bandes, poids }] }`.
 * Each element reads one numeric measure through a dotted path, finds the
 * first band containing the value (`min` inclusive, `max` exclusive, null for
 * open) and takes that band's score. The criterion score is the weighted sum of
 * the band scores, normalised to `score_max`:
 *   score = score_max * sum(poids * score_bande) / sum(poids * max(bandes.score))
 * A missing or null measure scores 0 for its element and is flagged; its weight
 * still counts in the denominator so a measure that cannot be computed lowers
 * the score instead of silently inflating it.
 */
import { z } from 'zod'
import type { SousNotes } from './evaluation.js'
import { arrondirCentiemes, IsoTimestampSchema, UuidSchema } from './primitives.js'

export const VERSION_REGLE_CRITERE = 1

/** Dotted path into `analyses.mesures`, for example `debit.mots_par_minute`. */
export const CheminMesureSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[^.\s][^.]*(\.[^.]+)*$/, 'Chemin de mesure attendu, par exemple debit.mots_par_minute')
export type CheminMesure = z.infer<typeof CheminMesureSchema>

/** `cle` of a criterion, used as key in `evaluations.sous_notes`. */
export const CleCritereSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_]*$/, 'Clé en minuscules, chiffres et tirets bas')
export type CleCritere = z.infer<typeof CleCritereSchema>

export const BandeSchema = z
  .object({
    min: z.number().nullable(),
    max: z.number().nullable(),
    score: z.number().min(0),
  })
  .refine((bande) => bande.min === null || bande.max === null || bande.min <= bande.max, {
    path: ['max'],
    message: 'max doit être supérieur ou égal à min',
  })
export type Bande = z.infer<typeof BandeSchema>

export const ElementRegleSchema = z.object({
  mesure: CheminMesureSchema,
  bandes: z.array(BandeSchema).min(1),
  poids: z.number().positive(),
})
export type ElementRegle = z.infer<typeof ElementRegleSchema>

export const RegleCritereV1Schema = z.object({
  version: z.literal(1),
  score_max: z.number().positive(),
  /**
   * Empty for a judged axis: there is nothing to compute, the model scores it against Rebecca's
   * worked examples. A measured axis without a single element is refused where the source is
   * known, which is the form and the grid editor.
   */
  elements: z.array(ElementRegleSchema),
})
export type RegleCritereV1 = z.infer<typeof RegleCritereV1Schema>

/** Every version of the rule shape. Only v1 exists today. */
export const RegleCritereSchema = z.discriminatedUnion('version', [RegleCritereV1Schema])
export type RegleCritere = z.infer<typeof RegleCritereSchema>

/** A row of `criteres_grille` as read back from the database. */
/**
 * A measured axis is computed from the audio. A judged one is scored by the model against
 * Rebecca's reference, held in place by a worked example at five and one at two (chapter 5,
 * rewritten 12 September 2026).
 */
export const SOURCES_CRITERE = ['mesure', 'jugement'] as const
export const SourceCritereSchema = z.enum(SOURCES_CRITERE)
export type SourceCritere = z.infer<typeof SourceCritereSchema>

export const CritereGrilleSchema = z.object({
  id: UuidSchema,
  grille_id: UuidSchema,
  cle: CleCritereSchema,
  nom: z.string().min(1),
  definition: z.string().min(1),
  source: SourceCritereSchema.default('mesure'),
  exemple_cinq: z.string().nullable().default(null),
  exemple_deux: z.string().nullable().default(null),
  regle: RegleCritereSchema,
  ordre: z.int().min(0),
  cree_le: IsoTimestampSchema,
  modifie_le: IsoTimestampSchema,
})
export type CritereGrille = z.output<typeof CritereGrilleSchema>

/** A row of `grilles` as read back from the database. */
export const GrilleSchema = z.object({
  id: UuidSchema,
  version: z.int().min(1),
  publiee_le: IsoTimestampSchema.nullable(),
  notes: z.string().nullable(),
  cree_par: UuidSchema.nullable(),
  cree_le: IsoTimestampSchema,
  modifie_le: IsoTimestampSchema,
})
export type Grille = z.output<typeof GrilleSchema>

export function estGrillePubliee(grille: Pick<Grille, 'publiee_le'>): boolean {
  return grille.publiee_le !== null
}

/**
 * Resolves a dotted path into a JSON value. Returns null unless the path lands
 * on a finite number. Never throws: a missing key, a null section, an array or
 * a non-object input all yield null.
 */
export function lireMesure(mesures: unknown, chemin: string): number | null {
  let courant: unknown = mesures
  for (const segment of chemin.split('.')) {
    if (courant === null || typeof courant !== 'object' || Array.isArray(courant)) return null
    courant = (courant as Record<string, unknown>)[segment]
  }
  return typeof courant === 'number' && Number.isFinite(courant) ? courant : null
}

export interface DetailElementRegle {
  /** Dotted path of the measure. */
  mesure: string
  /** Value read from the measures, null when missing. */
  valeur: number | null
  /** Index of the band that matched, null when none did. */
  bande: number | null
  /** Score given by the matched band, 0 when none matched. */
  score_bande: number
  /** Highest score among the element's bands. */
  score_max_bande: number
  poids: number
  /** The measure was absent, null or not a number. */
  manquante: boolean
  /** The measure exists but no band contains it. */
  hors_bandes: boolean
}

export interface ResultatRegle {
  score: number
  max: number
  details: DetailElementRegle[]
}

/** First band containing the value: `min` inclusive, `max` exclusive, null is open. */
function indexBande(bandes: readonly Bande[], valeur: number): number | null {
  for (let i = 0; i < bandes.length; i += 1) {
    const bande = bandes[i]
    if (bande === undefined) continue
    const auDessusDuMin = bande.min === null || valeur >= bande.min
    const sousLeMax = bande.max === null || valeur < bande.max
    if (auDessusDuMin && sousLeMax) return i
  }
  return null
}

function evaluerElement(element: ElementRegle, mesures: unknown): DetailElementRegle {
  const scoreMaxBande = element.bandes.reduce((max, bande) => Math.max(max, bande.score), 0)
  const valeur = lireMesure(mesures, element.mesure)
  const base = {
    mesure: element.mesure,
    valeur,
    poids: element.poids,
    score_max_bande: scoreMaxBande,
  }
  if (valeur === null) {
    return { ...base, bande: null, score_bande: 0, manquante: true, hors_bandes: false }
  }
  const index = indexBande(element.bandes, valeur)
  if (index === null) {
    return { ...base, bande: null, score_bande: 0, manquante: false, hors_bandes: true }
  }
  return {
    ...base,
    bande: index,
    score_bande: element.bandes[index]?.score ?? 0,
    manquante: false,
    hors_bandes: false,
  }
}

function evaluerRegleV1(regle: RegleCritereV1, mesures: unknown): ResultatRegle {
  const details = regle.elements.map((element) => evaluerElement(element, mesures))
  let somme = 0
  let sommeMax = 0
  for (const detail of details) {
    somme += detail.poids * detail.score_bande
    sommeMax += detail.poids * detail.score_max_bande
  }
  const brut = sommeMax > 0 ? (somme / sommeMax) * regle.score_max : 0
  const score = arrondirCentiemes(Math.min(Math.max(brut, 0), regle.score_max))
  return { score, max: regle.score_max, details }
}

/**
 * Scores one criterion rule against the measures. Pure and total: it never
 * throws, whatever the measures contain; missing measures are flagged in
 * `details` and score 0 for their element.
 */
export function evaluerRegle(regle: RegleCritere, mesures: unknown): ResultatRegle {
  switch (regle.version) {
    case 1:
      return evaluerRegleV1(regle, mesures)
  }
}

export interface ResultatCriteres {
  sous_notes: SousNotes
  /** Sum of the sub-scores, rounded to two decimals. */
  note_totale: number
  /** Sum of the maxima, rounded to two decimals. */
  max_total: number
  details: Record<string, ResultatRegle>
}

/**
 * Scores every criterion of a grid and assembles `evaluations.sous_notes` and
 * `note_totale`. Criteria are keyed by `cle`; a duplicate key keeps the last one.
 */
export function evaluerCriteres(
  criteres: ReadonlyArray<Pick<CritereGrille, 'cle' | 'regle'>>,
  mesures: unknown,
): ResultatCriteres {
  const sousNotes: SousNotes = {}
  const details: Record<string, ResultatRegle> = {}
  let noteTotale = 0
  let maxTotal = 0
  for (const critere of criteres) {
    const resultat = evaluerRegle(critere.regle, mesures)
    sousNotes[critere.cle] = { score: resultat.score, max: resultat.max }
    details[critere.cle] = resultat
  }
  for (const sousNote of Object.values(sousNotes)) {
    noteTotale += sousNote.score
    maxTotal += sousNote.max
  }
  return {
    sous_notes: sousNotes,
    note_totale: arrondirCentiemes(noteTotale),
    max_total: arrondirCentiemes(maxTotal),
    details,
  }
}
