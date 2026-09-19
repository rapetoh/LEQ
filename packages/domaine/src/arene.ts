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
  /** The day from which this subject goes first. Empty: it follows the order. */
  prevu_le: z.string().nullable().default(null),
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

/**
 * A take publishes on send. `signalee` is the one the automatic screening held back for Rebecca
 * (2026-09-17: the approval queue of Phase 7 is gone, the cahier only asks for withdrawal).
 */
export const STATUTS_PRISE_PUBLIQUE = ['signalee', 'publiee', 'retiree'] as const
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
  /** Who withdrew it: the person themselves, or Rebecca. Null while it is not withdrawn. */
  retiree_par: z.enum(['personne', 'admin']).nullable().default(null),
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

/**
 * `sans_verdict`: both spoke and the analysis could not separate them, because no grid is
 * published or an evaluation never landed. It is not a draw, and it is above all not an expiry:
 * nobody stayed silent.
 */
export const VERDICTS_DUEL = ['inviteur', 'invite', 'egalite', 'sans_verdict'] as const
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
    /** The seat is this caller's own: coming back resumes, it does not get refused. */
    c_est_moi: z.boolean().default(false),
    /** The caller sent this invitation. */
    c_est_mon_duel: z.boolean().default(false),
    /** Who sent it, so the page says « Roch te défie » rather than « tu as été défié·e ». */
    inviteur_prenom: z.string().nullable().default(null),
  }),
])
export type DuelParJeton = z.output<typeof DuelParJetonSchema>

/** The three measures the duel screen puts side by side once both have spoken. */
export const MesuresDuelSchema = z.object({
  mots_par_minute: z.number().nullable().default(null),
  bequilles: z.int().nullable().default(null),
  silences_tenus: z.int().nullable().default(null),
})
export type MesuresDuel = z.output<typeof MesuresDuelSchema>

/**
 * One side of a duel as `mes_duels()` answers it: whether that person has spoken, the path the
 * caller may play (their own take while it exists, the other's once the duel is closed), the
 * length of the take, and its measures once the duel is closed.
 */
export const CoteDuelSchema = z.object({
  a_parle: z.boolean(),
  prise_id: UuidSchema.nullable().default(null),
  chemin_audio: z.string().nullable().default(null),
  /** The take exists and nobody may play it: withdrawn, held, or its audio already deleted. */
  retenue: z.boolean().default(false),
  duree_s: z.number().nullable().default(null),
  mesures: MesuresDuelSchema.nullable().default(null),
})
export type CoteDuel = z.output<typeof CoteDuelSchema>

export const ROLES_DUEL = ['inviteur', 'invite'] as const
export const RoleDuelSchema = z.enum(ROLES_DUEL)
export type RoleDuel = z.infer<typeof RoleDuelSchema>

/** A duel read by one of its two participants (`mes_duels()`, 2026-09-18). */
export const DuelVueSchema = z.object({
  id: UuidSchema,
  sujet: z.string().min(1),
  statut: StatutDuelSchema,
  verdict: VerdictDuelSchema.nullable(),
  echeance: IsoTimestampSchema,
  cree_le: IsoTimestampSchema,
  clos_le: IsoTimestampSchema.nullable(),
  duree_max_s: z.int().positive(),
  role: RoleDuelSchema,
  /** The invitation token, given to the inviter only, to share the link again. */
  jeton: z.string().nullable().default(null),
  /** Null until someone joins. */
  adversaire: z
    .object({ prenom: z.string().nullable(), avatar: z.string().nullable() })
    .nullable()
    .default(null),
  moi: CoteDuelSchema,
  lui: CoteDuelSchema,
})
export type DuelVue = z.output<typeof DuelVueSchema>

/** The outcome of a duel as read by one side; `null` while it is open or without verdict. */
export function issueDuel(
  duel: Pick<DuelVue, 'statut' | 'verdict' | 'role'>,
): 'gagne' | 'perdu' | 'egalite' | 'sans_verdict' | null {
  if (duel.statut !== 'clos' || duel.verdict === null) return null
  if (duel.verdict === 'egalite') return 'egalite'
  if (duel.verdict === 'sans_verdict') return 'sans_verdict'
  return duel.verdict === duel.role ? 'gagne' : 'perdu'
}

/** `assez_ecoute`: six takes heard today. A listening limit, never a limit on who may speak. */
export const RAISONS_PAIRE = [
  'ok',
  'aucun_sujet',
  'parle_d_abord',
  'rien_a_comparer',
  'assez_ecoute',
] as const
export const RaisonPaireSchema = z.enum(RAISONS_PAIRE)
export type RaisonPaire = z.infer<typeof RaisonPaireSchema>

/** What `paire_a_voter()` answers: two takes to compare, or why there is nothing to compare. */
/** Where the person stands in the day's listening: `prises_ecoutees_par_jour` is the allowance. */
const EcouteDuJour = {
  ecoutees: z.int().min(0).default(0),
  plafond: z.int().min(0).default(0),
}

export const PaireAVoterSchema = z.discriminatedUnion('raison', [
  z.object({ raison: z.literal('aucun_sujet') }),
  z.object({ raison: z.literal('parle_d_abord') }),
  /** `autres`: how many other published voices there are at all (0, 1, or every pair voted). */
  z.object({
    raison: z.literal('rien_a_comparer'),
    autres: z.int().min(0).default(0),
    ...EcouteDuJour,
  }),
  z.object({ raison: z.literal('assez_ecoute'), ...EcouteDuJour }),
  z.object({
    raison: z.literal('ok'),
    sujet: z.object({ id: UuidSchema, texte: z.string(), consigne: z.string().nullable() }),
    ...EcouteDuJour,
    a: z.object({ id: UuidSchema, duree_s: z.number().nullable().default(null) }),
    b: z.object({ id: UuidSchema, duree_s: z.number().nullable().default(null) }),
  }),
])
export type PaireAVoter = z.output<typeof PaireAVoterSchema>

export const LigneClassementSchema = z.object({
  rang: PgBigIntSchema,
  prise_id: UuidSchema,
  votes: z.int().min(0),
  moi: z.boolean(),
  nom: z.string(),
  /** True when `nom` is « Passage N »: the phone then draws a neutral mark, not a letter. */
  pseudonyme: z.boolean().default(false),
  /** Path in the `avatars` bucket, only where the name is shown. */
  avatar: z.string().nullable().default(null),
  /** Length of the passage, in seconds. */
  duree_s: z.number().nullable().default(null),
  /** Path in `audio-public`, only when the caller may hear it: their own, the others' once they have spoken. */
  chemin_audio: z.string().nullable().default(null),
  /** Points this place was paid when the week closed, read from the ledger; 0 when none. */
  points: z.int().min(0).default(0),
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
  'deja_publie',
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
  'prenom_requis',
  'email_requis',
  'sujet_ferme',
] as const
export type RefusArene = (typeof REFUS_ARENE)[number]

export function lireRefusArene(message: string): RefusArene | null {
  return REFUS_ARENE.find((refus) => message.includes(refus)) ?? null
}

/** A duel invitation link: the web page of `apps/web` opens it without the app. */
export function lienInvitationDuel(base: string, jeton: string): string {
  return `${base.replace(/\/$/, '')}/duel/${jeton}`
}
