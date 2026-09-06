/**
 * `analyses.mesures`, version 1. Computed deterministically by packages/moteur
 * from PCM plus the timed transcript. A leaf is null when the measure cannot be
 * computed (for example pitch on a silent take); sections are always present.
 */
import { z } from 'zod'

export const VERSION_MESURES = 1

/** Filler words, v1 (French). Rebecca edits this list in Phase 6. */
export const MOTS_BEQUILLES_V1 = [
  'euh',
  'du coup',
  'en fait',
  'genre',
  'voilà',
  'donc',
  'bah',
  'ben',
  'hein',
  'tu vois',
  'en gros',
  'enfin',
] as const
export type MotBequilleV1 = (typeof MOTS_BEQUILLES_V1)[number]

/** Where a silence sits, decided from transcript punctuation and pause length. */
export const PLACES_SILENCE = ['debut', 'fin_de_phrase', 'milieu_de_phrase'] as const
export const PlaceSilenceSchema = z.enum(PLACES_SILENCE)
export type PlaceSilence = z.infer<typeof PlaceSilenceSchema>

/** A pause counts as "tenu" from this length, in seconds. */
export const SEUIL_SILENCE_TENU_S = 1.0
/** Window length used for `debit.fenetres` and `debit.stabilite`, in seconds. */
export const FENETRE_DEBIT_S = 10
/** `volume.chutes_fin_phrase`: last 400 ms at least 6 dB below the sentence mean. */
export const CHUTE_FIN_PHRASE_FENETRE_MS = 400
export const CHUTE_FIN_PHRASE_SEUIL_DB = 6

const Duree = z.number().min(0)
const Compte = z.int().min(0)
const Ratio = z.number().min(0).max(1)

export const FenetreDebitSchema = z.object({
  debut_s: Duree,
  fin_s: Duree,
  mots_par_minute: z.number().min(0),
})
export type FenetreDebit = z.infer<typeof FenetreDebitSchema>

export const OccurrenceMotBequilleSchema = z.object({
  mot: z.string().min(1),
  debut_s: Duree,
})
export type OccurrenceMotBequille = z.infer<typeof OccurrenceMotBequilleSchema>

export const PositionSilenceSchema = z.object({
  debut_s: Duree,
  duree_s: Duree,
  place: PlaceSilenceSchema,
})
export type PositionSilence = z.infer<typeof PositionSilenceSchema>

export const SegmentSansPauseSchema = z.object({
  debut_s: Duree,
  fin_s: Duree,
  mots: Compte,
})
export type SegmentSansPause = z.infer<typeof SegmentSansPauseSchema>

export const OccurrenceRepetitionSchema = z.object({
  texte: z.string().min(1),
  debut_s: Duree,
})
export type OccurrenceRepetition = z.infer<typeof OccurrenceRepetitionSchema>

export const MesuresV1Schema = z.object({
  version: z.literal(1),
  duree_totale_s: Duree,
  duree_parole_s: Duree,
  temps_avant_demarrage_s: Duree.nullable(),
  debit: z.object({
    mots_par_minute: z.number().min(0).nullable(),
    /** Coefficient of variation of mots_par_minute across 10 s windows. */
    stabilite: z.number().min(0).nullable(),
    fenetres: z.array(FenetreDebitSchema),
  }),
  mots_bequilles: z.object({
    total: Compte,
    par_minute: z.number().min(0).nullable(),
    par_type: z.record(z.string(), Compte),
    occurrences: z.array(OccurrenceMotBequilleSchema),
  }),
  silences: z.object({
    total: Compte,
    /** Pauses of at least SEUIL_SILENCE_TENU_S. */
    tenus: Compte,
    duree_moyenne_s: Duree.nullable(),
    duree_max_s: Duree.nullable(),
    positions: z.array(PositionSilenceSchema),
  }),
  souffle: z.object({
    segments_sans_pause: z.array(SegmentSansPauseSchema),
    longueur_max_s: Duree.nullable(),
  }),
  volume: z.object({
    moyen_db: z.number().nullable(),
    ecart_type_db: z.number().min(0).nullable(),
    chutes_fin_phrase: Compte,
    ratio_chutes: Ratio.nullable(),
  }),
  hauteur: z.object({
    f0_median_hz: z.number().positive().nullable(),
    f0_ecart_type_demi_tons: z.number().min(0).nullable(),
    plage_demi_tons: z.number().min(0).nullable(),
    ratio_voise: Ratio.nullable(),
  }),
  repetitions: z.object({
    total: Compte,
    reprises: Compte,
    occurrences: z.array(OccurrenceRepetitionSchema),
  }),
  phrases: z.object({
    nombre: Compte,
    longueur_moyenne_mots: z.number().min(0).nullable(),
    longueur_max_mots: Compte.nullable(),
  }),
})
export type MesuresV1 = z.infer<typeof MesuresV1Schema>

/** Every version of the measures shape. Only v1 exists today. */
export const MesuresSchema = z.discriminatedUnion('version', [MesuresV1Schema])
export type Mesures = z.infer<typeof MesuresSchema>

/**
 * Dotted paths to the numeric leaves of MesuresV1, the values a grid rule can
 * point at. `mots_bequilles.par_type.<mot>` is also valid but depends on the
 * filler list, so it is not enumerated here.
 */
export const CHEMINS_MESURES_V1 = [
  'duree_totale_s',
  'duree_parole_s',
  'temps_avant_demarrage_s',
  'debit.mots_par_minute',
  'debit.stabilite',
  'mots_bequilles.total',
  'mots_bequilles.par_minute',
  'silences.total',
  'silences.tenus',
  'silences.duree_moyenne_s',
  'silences.duree_max_s',
  'souffle.longueur_max_s',
  'volume.moyen_db',
  'volume.ecart_type_db',
  'volume.chutes_fin_phrase',
  'volume.ratio_chutes',
  'hauteur.f0_median_hz',
  'hauteur.f0_ecart_type_demi_tons',
  'hauteur.plage_demi_tons',
  'hauteur.ratio_voise',
  'repetitions.total',
  'repetitions.reprises',
  'phrases.nombre',
  'phrases.longueur_moyenne_mots',
  'phrases.longueur_max_mots',
] as const
export type CheminMesureV1 = (typeof CHEMINS_MESURES_V1)[number]

const PREFIXE_PAR_TYPE = 'mots_bequilles.par_type.'

/** True for an enumerated leaf or a `mots_bequilles.par_type.<mot>` path. */
export function estCheminMesureV1(chemin: string): boolean {
  return (
    (CHEMINS_MESURES_V1 as readonly string[]).includes(chemin) ||
    (chemin.startsWith(PREFIXE_PAR_TYPE) && chemin.length > PREFIXE_PAR_TYPE.length)
  )
}
