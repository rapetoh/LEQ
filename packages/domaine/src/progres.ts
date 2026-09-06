/**
 * Phase 5: the streak, the points ledger, the shop, and the JSON answered by the
 * progress functions (`ma_serie`, `mes_points`, `mes_recompenses`, `resume_progres`).
 * Ledgers, not counters (ADR-009).
 */
import { z } from 'zod'
import { IsoTimestampSchema, PgBigIntSchema, PgNumericSchema, UuidSchema } from './primitives.js'
import { FormuleSchema } from './parcours.js'

export const MOTIFS_POINTS = [
  'defi_valide',
  'vote',
  'echange',
  'remboursement',
  'ajustement',
] as const
export const MotifPointsSchema = z.enum(MOTIFS_POINTS)
export type MotifPoints = z.infer<typeof MotifPointsSchema>

export const MouvementPointsSchema = z.object({
  id: UuidSchema,
  utilisateur_id: UuidSchema,
  montant: z.int(),
  motif: MotifPointsSchema,
  reference: z.string().nullable(),
  cree_le: IsoTimestampSchema,
})
export type MouvementPoints = z.output<typeof MouvementPointsSchema>

export const TYPES_RECOMPENSE = ['contenu', 'reduction', 'atelier', 'distinction'] as const
export const TypeRecompenseSchema = z.enum(TYPES_RECOMPENSE)
export type TypeRecompense = z.infer<typeof TypeRecompenseSchema>

/** French labels of the reward types, for the admin. */
export const NOMS_TYPE_RECOMPENSE: Readonly<Record<TypeRecompense, string>> = {
  contenu: 'Contenu',
  reduction: 'Réduction',
  atelier: 'Atelier',
  distinction: 'Distinction',
}

export const RecompenseSchema = z.object({
  id: UuidSchema,
  cle: z.string().min(1),
  ordre: z.int(),
  type: TypeRecompenseSchema,
  titre: z.string().min(1),
  sous_titre: z.string().nullable(),
  description: z.string().nullable(),
  cout_points: z.int().positive().nullable(),
  plafond_par_mois: z.int().positive().nullable(),
  echangeable: z.boolean(),
  provisoire: z.boolean(),
  actif: z.boolean(),
  cree_le: IsoTimestampSchema,
  modifie_le: IsoTimestampSchema,
})
export type Recompense = z.output<typeof RecompenseSchema>
export const RecompenseEditableSchema = RecompenseSchema.omit({
  id: true,
  cree_le: true,
  modifie_le: true,
}).refine((r) => !r.echangeable || r.cout_points !== null, {
  path: ['cout_points'],
  message: 'Une récompense échangeable a un coût en points',
})
export type RecompenseEditable = z.output<typeof RecompenseEditableSchema>

export const STATUTS_ECHANGE = ['a_traiter', 'honore', 'annule'] as const
export const StatutEchangeSchema = z.enum(STATUTS_ECHANGE)
export type StatutEchange = z.infer<typeof StatutEchangeSchema>

export const EchangeRecompenseSchema = z.object({
  id: UuidSchema,
  utilisateur_id: UuidSchema,
  recompense_id: UuidSchema,
  cout_points: z.int(),
  statut: StatutEchangeSchema,
  note: z.string().nullable(),
  cree_le: IsoTimestampSchema,
  traite_le: IsoTimestampSchema.nullable(),
})
export type EchangeRecompense = z.output<typeof EchangeRecompenseSchema>

/** `YYYY-MM-DD` as the functions write it. */
export const JourSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/** The JSON of `ma_serie()` and `calculer_serie()`. */
export const SerieSchema = z.object({
  aujourdhui: JourSchema,
  courante: z.int().min(0),
  record: z.int().min(0),
  semaines_gagnees: z.int().min(0),
  derniere_journee: JourSchema.nullable(),
  validee_aujourdhui: z.boolean(),
  semaine: z.array(z.object({ jour: JourSchema, actif: z.boolean() })).length(7),
  recuperation: z.object({
    par_mois: z.int().min(0),
    utilisees_ce_mois: z.int().min(0),
    restantes: z.int().min(0),
    /** Yesterday when the streak broke by exactly one day, whatever the quota. */
    jour_reparable: JourSchema.nullable(),
    /** `jour_reparable` when a recovery is left this month; what "Activer" covers. */
    jour_a_couvrir: JourSchema.nullable(),
  }),
})
export type Serie = z.output<typeof SerieSchema>

/** The JSON of `mes_points()`. Sums come back as bigint strings. */
export const PointsSchema = z.object({
  solde: z.int(),
  cumul: PgBigIntSchema,
  cette_semaine: PgBigIntSchema,
  formule: FormuleSchema,
})
export type Points = z.output<typeof PointsSchema>

/** One reward as `mes_recompenses()` lists it, with the month's remaining quantity. */
export const RecompenseBoutiqueSchema = z.object({
  id: UuidSchema,
  cle: z.string(),
  ordre: z.int(),
  type: TypeRecompenseSchema,
  titre: z.string(),
  sous_titre: z.string().nullable(),
  description: z.string().nullable(),
  cout_points: z.int().nullable(),
  plafond_par_mois: z.int().nullable(),
  echangeable: z.boolean(),
  provisoire: z.boolean(),
  restantes_ce_mois: z.int().nullable(),
  mes_echanges: PgBigIntSchema,
})
export type RecompenseBoutique = z.output<typeof RecompenseBoutiqueSchema>

export const BoutiqueSchema = z.object({
  points: PointsSchema,
  recompenses: z.array(RecompenseBoutiqueSchema),
  echanges: z.array(
    z.object({
      id: UuidSchema,
      recompense_id: UuidSchema,
      titre: z.string(),
      cout_points: z.int(),
      statut: StatutEchangeSchema,
      cree_le: IsoTimestampSchema,
      traite_le: IsoTimestampSchema.nullable(),
    }),
  ),
})
export type Boutique = z.output<typeof BoutiqueSchema>

/** Reasons `echanger_recompense()` refuses, carried in the error message. */
export const REFUS_ECHANGE = [
  'points_insuffisants',
  'plafond_atteint',
  'recompense_indisponible',
  'recompense_non_echangeable',
  'compte_requis',
] as const
export type RefusEchange = (typeof REFUS_ECHANGE)[number]

export function lireRefusEchange(message: string): RefusEchange | null {
  return REFUS_ECHANGE.find((refus) => message.includes(refus)) ?? null
}

/** Reasons `activer_recuperation_serie()` refuses. */
export const REFUS_RECUPERATION = ['quota_epuise', 'rien_a_couvrir'] as const
export type RefusRecuperation = (typeof REFUS_RECUPERATION)[number]

export function lireRefusRecuperation(message: string): RefusRecuperation | null {
  return REFUS_RECUPERATION.find((refus) => message.includes(refus)) ?? null
}

const MesurePriseSchema = z
  .object({
    enregistre_le: IsoTimestampSchema,
    debit: PgNumericSchema.nullable(),
    bequilles_par_minute: PgNumericSchema.nullable(),
    silences_tenus: z.int().nullable(),
  })
  .nullable()

/** The JSON of `resume_progres()` (D1, D1b). */
export const ResumeProgresSchema = z.object({
  serie: SerieSchema,
  points: PointsSchema,
  mois: z.object({
    prises: PgBigIntSchema,
    duree_parole_s: PgNumericSchema,
    defis_releves: PgBigIntSchema,
  }),
  premiere: MesurePriseSchema,
  derniere: MesurePriseSchema,
  bequilles_semaines: z.array(
    z.object({
      semaine: JourSchema,
      prises: PgBigIntSchema,
      par_type: z.record(z.string(), PgBigIntSchema),
    }),
  ),
})
export type ResumeProgres = z.output<typeof ResumeProgresSchema>

/** "2 h 14" for the month's talk time; under an hour, "38 min". */
export function formaterDureeLongue(secondes: number): string {
  const minutes = Math.round(secondes / 60)
  if (minutes < 60) return `${minutes} min`
  const heures = Math.floor(minutes / 60)
  const reste = minutes % 60
  return `${heures} h ${String(reste).padStart(2, '0')}`
}
