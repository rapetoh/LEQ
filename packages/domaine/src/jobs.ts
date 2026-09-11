/**
 * Table `jobs`: the work queue. pg_cron and triggers only insert jobs; the
 * worker claims and executes them.
 */
import { z } from 'zod'
import { IsoTimestampSchema, PgBigIntSchema, UuidSchema } from './primitives.js'

export const TYPES_JOB = [
  'analyser_tentative',
  'supprimer_compte',
  'balayer_audio',
  'purger_anonymes',
  'envoyer_annonce',
  'roter_sujet_arene',
  'fermer_duels',
  'supprimer_audio_public',
] as const
export const TypeJobSchema = z.enum(TYPES_JOB)
export type TypeJob = z.infer<typeof TypeJobSchema>

export const STATUTS_JOB = ['en_attente', 'en_cours', 'termine', 'echoue'] as const
export const StatutJobSchema = z.enum(STATUTS_JOB)
export type StatutJob = z.infer<typeof StatutJobSchema>

/** Column default of `jobs.essais_max`. */
export const ESSAIS_MAX_JOB_PAR_DEFAUT = 5
/** `echouer_job` waits `30 s * 2^essais` before the next attempt. */
export const DELAI_BASE_NOUVEL_ESSAI_S = 30

export function delaiAvantNouvelEssaiS(essais: number): number {
  return DELAI_BASE_NOUVEL_ESSAI_S * 2 ** Math.max(0, Math.floor(essais))
}

/** Inserted by the `after insert` trigger on `tentatives`. */
export const ChargeAnalyserTentativeSchema = z.object({
  tentative_id: UuidSchema,
})
export type ChargeAnalyserTentative = z.infer<typeof ChargeAnalyserTentativeSchema>

/** Inserted by the server when a person deletes their account (rows plus storage objects). */
export const ChargeSupprimerCompteSchema = z.object({
  utilisateur_id: UuidSchema,
})
export type ChargeSupprimerCompte = z.infer<typeof ChargeSupprimerCompteSchema>

/** Inserted by pg_cron every 30 minutes; the age threshold comes from `configuration`. */
export const ChargeBalayerAudioSchema = z.object({})
export type ChargeBalayerAudio = z.infer<typeof ChargeBalayerAudioSchema>

/** Inserted by pg_cron every hour; the purge window comes from `configuration`. */
export const ChargePurgerAnonymesSchema = z.object({})
export type ChargePurgerAnonymes = z.infer<typeof ChargePurgerAnonymesSchema>

/** Inserted by `publier_annonce()` (Phase 6): one push campaign. */
export const ChargeEnvoyerAnnonceSchema = z.object({
  annonce_id: UuidSchema,
})
export type ChargeEnvoyerAnnonce = z.infer<typeof ChargeEnvoyerAnnonceSchema>

/** Inserted by pg_cron every hour: the weekly rotation of the Arena subject (Phase 7). */
export const ChargeRoterSujetAreneSchema = z.object({})
/** Inserted by pg_cron every 15 minutes: duels to close or expire (Phase 7). */
export const ChargeFermerDuelsSchema = z.object({})
/** Inserted by pg_cron every 30 minutes: the audio of closed weeks and duels (Phase 7). */
export const ChargeSupprimerAudioPublicSchema = z.object({})

/** One charge schema per job type. */
export const CHARGES_JOB = {
  analyser_tentative: ChargeAnalyserTentativeSchema,
  supprimer_compte: ChargeSupprimerCompteSchema,
  balayer_audio: ChargeBalayerAudioSchema,
  purger_anonymes: ChargePurgerAnonymesSchema,
  envoyer_annonce: ChargeEnvoyerAnnonceSchema,
  roter_sujet_arene: ChargeRoterSujetAreneSchema,
  fermer_duels: ChargeFermerDuelsSchema,
  supprimer_audio_public: ChargeSupprimerAudioPublicSchema,
} as const satisfies Record<TypeJob, z.ZodType>

export type ChargeJob<T extends TypeJob = TypeJob> = z.output<(typeof CHARGES_JOB)[T]>

/** Parses the `charge` column of a claimed job into its typed shape. */
export function lireChargeJob<T extends TypeJob>(type: T, charge: unknown): ChargeJob<T> {
  return CHARGES_JOB[type].parse(charge) as ChargeJob<T>
}

/** `cle_idempotence` written by the trigger on `tentatives`: `'analyser:' || id`. */
export const PREFIXE_IDEMPOTENCE_ANALYSER = 'analyser:'
export function cleIdempotenceAnalyser(tentativeId: string): string {
  return `${PREFIXE_IDEMPOTENCE_ANALYSER}${tentativeId}`
}

/** `cle_idempotence` written by pg_cron: `'balayer:' || date_trunc('hour', now())`. */
export const PREFIXE_IDEMPOTENCE_BALAYAGE = 'balayer:'

/** `cle_idempotence` written by `publier_annonce()`: `'annonce:' || id`. */
export const PREFIXE_IDEMPOTENCE_ANNONCE = 'annonce:'

/** `cle_idempotence` used by the server for account deletion, one job per person. */
export const PREFIXE_IDEMPOTENCE_SUPPRESSION = 'supprimer:'
export function cleIdempotenceSupprimerCompte(utilisateurId: string): string {
  return `${PREFIXE_IDEMPOTENCE_SUPPRESSION}${utilisateurId}`
}

const JobBaseSchema = z.object({
  id: PgBigIntSchema,
  statut: StatutJobSchema,
  essais: z.int().min(0),
  essais_max: z.int().min(1),
  disponible_a: IsoTimestampSchema,
  verrouille_a: IsoTimestampSchema.nullable(),
  verrouille_par: z.string().nullable(),
  erreur: z.string().nullable(),
  cle_idempotence: z.string().nullable(),
  termine_le: IsoTimestampSchema.nullable(),
  cree_le: IsoTimestampSchema,
  modifie_le: IsoTimestampSchema,
})

/** A row of `jobs` as read back from the database, with its charge typed by `type`. */
export const JobSchema = z.discriminatedUnion('type', [
  JobBaseSchema.extend({
    type: z.literal('analyser_tentative'),
    charge: ChargeAnalyserTentativeSchema,
  }),
  JobBaseSchema.extend({
    type: z.literal('supprimer_compte'),
    charge: ChargeSupprimerCompteSchema,
  }),
  JobBaseSchema.extend({
    type: z.literal('balayer_audio'),
    charge: ChargeBalayerAudioSchema,
  }),
  JobBaseSchema.extend({
    type: z.literal('purger_anonymes'),
    charge: ChargePurgerAnonymesSchema,
  }),
  JobBaseSchema.extend({
    type: z.literal('envoyer_annonce'),
    charge: ChargeEnvoyerAnnonceSchema,
  }),
  JobBaseSchema.extend({
    type: z.literal('roter_sujet_arene'),
    charge: ChargeRoterSujetAreneSchema,
  }),
])
export type Job = z.output<typeof JobSchema>
export type JobDeType<T extends TypeJob> = Extract<Job, { type: T }>

const NouveauJobBaseSchema = z.object({
  disponible_a: IsoTimestampSchema.optional(),
  essais_max: z.int().min(1).optional(),
  cle_idempotence: z.string().min(1).nullable().optional(),
})

/** What the server inserts when it queues work itself (service role). */
export const NouveauJobSchema = z.discriminatedUnion('type', [
  NouveauJobBaseSchema.extend({
    type: z.literal('analyser_tentative'),
    charge: ChargeAnalyserTentativeSchema,
  }),
  NouveauJobBaseSchema.extend({
    type: z.literal('supprimer_compte'),
    charge: ChargeSupprimerCompteSchema,
  }),
  NouveauJobBaseSchema.extend({
    type: z.literal('balayer_audio'),
    charge: ChargeBalayerAudioSchema,
  }),
  NouveauJobBaseSchema.extend({
    type: z.literal('purger_anonymes'),
    charge: ChargePurgerAnonymesSchema,
  }),
  NouveauJobBaseSchema.extend({
    type: z.literal('envoyer_annonce'),
    charge: ChargeEnvoyerAnnonceSchema,
  }),
  NouveauJobBaseSchema.extend({
    type: z.literal('roter_sujet_arene'),
    charge: ChargeRoterSujetAreneSchema,
  }),
])
export type NouveauJob = z.output<typeof NouveauJobSchema>
