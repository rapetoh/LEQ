/**
 * Phase 8: the face-à-face against Rétor (cahier chapter 10). Shipped off behind the
 * `face_a_face` flag.
 *
 * Two rules of that chapter are visible in these types. The quota is a ledger, not a counter:
 * one row per session carrying its own outcome, and a session cut on our side keeps its row
 * while the month ignores it. And a debate is text, never audio: `tours_debat` holds the
 * written transcript the debrief reads, and nothing is ever stored of the voice itself.
 */
import { z } from 'zod'
import { IsoTimestampSchema, PgNumericSchema, UuidSchema } from './primitives.js'

export const TONS_ADVERSAIRE = ['ferme', 'provocateur', 'academique', 'bienveillant'] as const
export const TonAdversaireSchema = z.enum(TONS_ADVERSAIRE)
export type TonAdversaire = z.infer<typeof TonAdversaireSchema>

export const TheseSchema = z.object({
  id: UuidSchema,
  cle: z.string().min(1),
  texte: z.string().min(1),
  ton_suggere: TonAdversaireSchema,
  ordre: z.int().positive(),
  actif: z.boolean(),
  provisoire: z.boolean(),
  cree_le: IsoTimestampSchema,
  modifie_le: IsoTimestampSchema,
})
export type These = z.output<typeof TheseSchema>

export const TheseEditableSchema = TheseSchema.omit({
  id: true,
  cree_le: true,
  modifie_le: true,
})
export type TheseEditable = z.output<typeof TheseEditableSchema>

export const ORIGINES_THESE = ['banque', 'personnelle'] as const
export const OrigineTheseSchema = z.enum(ORIGINES_THESE)
export type OrigineThese = z.infer<typeof OrigineTheseSchema>

export const STATUTS_DEBAT = ['ouverte', 'terminee', 'interrompue', 'abandonnee'] as const
export const StatutDebatSchema = z.enum(STATUTS_DEBAT)
export type StatutDebat = z.infer<typeof StatutDebatSchema>

/** What a finished session did to the monthly quota. `interrompue_par_nous` costs nothing. */
export const ISSUES_DEBAT = ['terminee', 'interrompue_par_nous', 'abandonnee'] as const
export const IssueDebatSchema = z.enum(ISSUES_DEBAT)
export type IssueDebat = z.infer<typeof IssueDebatSchema>

/** The one outcome that does not consume a session: our cut, our cost (chapter 10). */
export function consommeUneSession(issue: IssueDebat | null): boolean {
  return issue !== null && issue !== 'interrompue_par_nous'
}

export const DebatSchema = z.object({
  id: UuidSchema,
  utilisateur_id: UuidSchema,
  these_id: UuidSchema.nullable(),
  these_texte: z.string().min(1),
  origine_these: OrigineTheseSchema,
  ton_adversaire: z.string().min(1),
  duree_max_s: z.int().positive(),
  statut: StatutDebatSchema,
  issue: IssueDebatSchema.nullable(),
  secondes_parlees: PgNumericSchema,
  commence_le: IsoTimestampSchema,
  derniere_activite_le: IsoTimestampSchema,
  termine_le: IsoTimestampSchema.nullable(),
  cree_le: IsoTimestampSchema,
  modifie_le: IsoTimestampSchema,
})
export type Debat = z.output<typeof DebatSchema>

export const LOCUTEURS = ['utilisateur', 'retor'] as const
export const LocuteurSchema = z.enum(LOCUTEURS)
export type Locuteur = z.infer<typeof LocuteurSchema>

export const TourDebatSchema = z.object({
  numero: z.int().positive(),
  locuteur: LocuteurSchema,
  texte: z.string(),
  duree_s: PgNumericSchema.nullable(),
})
export type TourDebat = z.output<typeof TourDebatSchema>

export const TranscriptionDebatSchema = z.array(TourDebatSchema)
export type TranscriptionDebat = z.output<typeof TranscriptionDebatSchema>

/** What `quota_debats()` answers: where the person stands this month. */
export const QuotaDebatsSchema = z.object({
  formule: z.string(),
  plafond: z.int().min(0),
  utilises: z.int().min(0),
  restants: z.int().min(0),
})
export type QuotaDebats = z.output<typeof QuotaDebatsSchema>

/** Reasons the database refuses to open a debate, carried in the error message. */
export const REFUS_DEBAT = [
  'compte_requis',
  'compte_suspendu',
  'face_a_face_eteint',
  'quota_epuise',
  'these_introuvable',
  'these_requise',
  'debat_en_cours',
] as const
export type RefusDebat = (typeof REFUS_DEBAT)[number]

export function lireRefusDebat(message: string): RefusDebat | null {
  return REFUS_DEBAT.find((refus) => message.includes(refus)) ?? null
}
