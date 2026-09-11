/**
 * Phase 7: the Arena and duels (cahier chapter 11). Shipped off behind the `arene` and `duels`
 * flags. Nothing becomes public without a deliberate gesture; the verdict of a duel is rendered
 * by the analysis, on Rebecca's grid, and the app says so.
 */
import { z } from 'zod'
import { IsoTimestampSchema, PgBigIntSchema, UuidSchema } from './primitives.js'

export const SujetAreneSchema = z.object({
  id: UuidSchema,
  cle: z.string().min(1),
  texte: z.string().min(1),
  consigne: z.string().nullable(),
  ordre: z.int().positive(),
  duree_max_s: z.int().positive(),
  actif_le: IsoTimestampSchema.nullable(),
  ferme_le: IsoTimestampSchema.nullable(),
  provisoire: z.boolean(),
  actif: z.boolean(),
  /** Set before the podium notification leaves, so a retry never notifies a week twice. */
  resultat_notifie_le: IsoTimestampSchema.nullable(),
  cree_le: IsoTimestampSchema,
  modifie_le: IsoTimestampSchema,
})
export type SujetArene = z.output<typeof SujetAreneSchema>
export const SujetAreneEditableSchema = SujetAreneSchema.omit({
  id: true,
  actif_le: true,
  ferme_le: true,
  resultat_notifie_le: true,
  cree_le: true,
  modifie_le: true,
})
export type SujetAreneEditable = z.output<typeof SujetAreneEditableSchema>

export const CONTEXTES_PRISE_PUBLIQUE = ['arene', 'duel'] as const
export const ContextePrisePubliqueSchema = z.enum(CONTEXTES_PRISE_PUBLIQUE)
export type ContextePrisePublique = z.infer<typeof ContextePrisePubliqueSchema>

export const STATUTS_PRISE_PUBLIQUE = ['en_moderation', 'publiee', 'retiree'] as const
export const StatutPrisePubliqueSchema = z.enum(STATUTS_PRISE_PUBLIQUE)
export type StatutPrisePublique = z.infer<typeof StatutPrisePubliqueSchema>

export const PrisePubliqueSchema = z.object({
  id: UuidSchema,
  utilisateur_id: UuidSchema,
  tentative_id: UuidSchema,
  contexte: ContextePrisePubliqueSchema,
  sujet_id: UuidSchema.nullable(),
  duel_id: UuidSchema.nullable(),
  chemin_audio: z.string().nullable(),
  statut: StatutPrisePubliqueSchema,
  motif_retrait: z.string().nullable(),
  votes_recus: z.int().min(0),
  date_suppression: IsoTimestampSchema.nullable(),
  audio_supprime_le: IsoTimestampSchema.nullable(),
  cree_le: IsoTimestampSchema,
  modifie_le: IsoTimestampSchema,
})
export type PrisePublique = z.output<typeof PrisePubliqueSchema>

export const STATUTS_DUEL = ['ouvert', 'clos', 'expire'] as const
export const StatutDuelSchema = z.enum(STATUTS_DUEL)
export type StatutDuel = z.infer<typeof StatutDuelSchema>

export const VERDICTS_DUEL = ['inviteur', 'invite', 'egalite'] as const
export const VerdictDuelSchema = z.enum(VERDICTS_DUEL)
export type VerdictDuel = z.infer<typeof VerdictDuelSchema>

export const DuelSchema = z.object({
  id: UuidSchema,
  inviteur_id: UuidSchema,
  invite_id: UuidSchema.nullable(),
  sujet: z.string().min(1),
  jeton: z.string().min(1),
  duree_max_s: z.int().positive(),
  statut: StatutDuelSchema,
  verdict: VerdictDuelSchema.nullable(),
  echeance: IsoTimestampSchema,
  clos_le: IsoTimestampSchema.nullable(),
  cree_le: IsoTimestampSchema,
  modifie_le: IsoTimestampSchema,
})
export type Duel = z.output<typeof DuelSchema>

/** What `lire_duel_par_jeton()` answers to an invitee who may not have the app. */
export const DuelParJetonSchema = z.discriminatedUnion('raison', [
  z.object({ raison: z.literal('introuvable') }),
  z.object({
    raison: z.literal('ok'),
    id: UuidSchema,
    sujet: z.string(),
    statut: StatutDuelSchema,
    duree_max_s: z.int().positive(),
    echeance: IsoTimestampSchema,
    deja_repondu: z.boolean(),
  }),
])
export type DuelParJeton = z.output<typeof DuelParJetonSchema>

export const RAISONS_PAIRE = ['ok', 'aucun_sujet', 'parle_d_abord', 'rien_a_comparer'] as const
export const RaisonPaireSchema = z.enum(RAISONS_PAIRE)
export type RaisonPaire = z.infer<typeof RaisonPaireSchema>

/** What `paire_a_voter()` answers: two takes to compare, or why there is nothing to compare. */
export const PaireAVoterSchema = z.discriminatedUnion('raison', [
  z.object({ raison: z.literal('aucun_sujet') }),
  z.object({ raison: z.literal('parle_d_abord') }),
  z.object({ raison: z.literal('rien_a_comparer') }),
  z.object({
    raison: z.literal('ok'),
    sujet: z.object({ id: UuidSchema, texte: z.string(), consigne: z.string().nullable() }),
    a: z.object({ id: UuidSchema }),
    b: z.object({ id: UuidSchema }),
  }),
])
export type PaireAVoter = z.output<typeof PaireAVoterSchema>

export const LigneClassementSchema = z.object({
  rang: PgBigIntSchema,
  prise_id: UuidSchema,
  votes: z.int().min(0),
  moi: z.boolean(),
  nom: z.string(),
})
export type LigneClassement = z.output<typeof LigneClassementSchema>

export const ClassementAreneSchema = z.object({
  sujet_id: UuidSchema.nullable(),
  classement: z.array(LigneClassementSchema),
})
export type ClassementArene = z.output<typeof ClassementAreneSchema>

/** Reasons the database refuses, carried in the error message. */
export const REFUS_ARENE = [
  'compte_requis',
  'compte_suspendu',
  'tentative_introuvable',
  'type_incompatible',
  'analyse_incomplete',
  'aucun_sujet',
  'duel_introuvable',
  'deja_vote',
  'vote_sur_soi',
  'parle_d_abord',
  'paire_invalide',
  'prise_introuvable',
  'duel_clos',
  'duel_expire',
  'duel_sur_soi',
  'duel_complet',
  'sujet_requis',
] as const
export type RefusArene = (typeof REFUS_ARENE)[number]

export function lireRefusArene(message: string): RefusArene | null {
  return REFUS_ARENE.find((refus) => message.includes(refus)) ?? null
}

/** A duel invitation link: the web page of `apps/web` opens it without the app. */
export function lienInvitationDuel(base: string, jeton: string): string {
  return `${base.replace(/\/$/, '')}/duel/${jeton}`
}
