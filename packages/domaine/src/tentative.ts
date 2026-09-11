/**
 * Table `tentatives`: one recording sent for analysis.
 *
 * Only server-side states exist here. Phone-only states (enregistrement,
 * en attente réseau, annulée, expirée) live in the phone's local queue and
 * never reach the database.
 */
import { z } from 'zod'
import {
  IanaTimezoneSchema,
  IsoTimestampSchema,
  PgNumericSchema,
  UuidSchema,
} from './primitives.js'

export const STATUTS_TENTATIVE = [
  'envoyee',
  'en_transcription',
  'en_mesure',
  'en_evaluation',
  'audio_supprime',
  'retour_disponible',
  'echec_technique',
  'abandon_technique',
] as const
export const StatutTentativeSchema = z.enum(STATUTS_TENTATIVE)
export type StatutTentative = z.infer<typeof StatutTentativeSchema>

/** States after which the worker never touches the row again. */
export const STATUTS_TENTATIVE_FINAUX = [
  'retour_disponible',
  'echec_technique',
  'abandon_technique',
] as const satisfies readonly StatutTentative[]

export function estStatutTentativeFinal(statut: StatutTentative): boolean {
  return (STATUTS_TENTATIVE_FINAUX as readonly StatutTentative[]).includes(statut)
}

export const TYPES_TENTATIVE = ['diagnostic', 'etape', 'arene', 'duel'] as const
export const TypeTentativeSchema = z.enum(TYPES_TENTATIVE)
export type TypeTentative = z.infer<typeof TypeTentativeSchema>

export const RESULTATS_TENTATIVE = ['etape_validee', 'etape_echouee'] as const
export const ResultatTentativeSchema = z.enum(RESULTATS_TENTATIVE)
export type ResultatTentative = z.infer<typeof ResultatTentativeSchema>

/** Private bucket holding the audio of a tentative until the worker deletes it. */
export const BUCKET_AUDIO_TENTATIVES = 'audio-tentatives'
/** Private bucket for Arena and duel takes (Phase 7), served by signed URL. */
export const BUCKET_AUDIO_PUBLIC = 'audio-public'
export const EXTENSION_AUDIO_TENTATIVE = 'm4a'

/** Object path inside `audio-tentatives`: `{utilisateur_id}/{id}.m4a`. */
export function cheminAudioTentative(utilisateurId: string, tentativeId: string): string {
  return `${utilisateurId}/${tentativeId}.${EXTENSION_AUDIO_TENTATIVE}`
}

/** Database check: `enregistre_le <= now() + 5 minutes`. */
export const MARGE_FUTUR_ENREGISTREMENT_MINUTES = 5
/** Database check: `enregistre_le >= now() - 8 days` (one day beyond the local queue expiry). */
export const AGE_MAX_ENREGISTREMENT_JOURS = 8

/**
 * Mirrors the insert check on `enregistre_le` so the phone can refuse an
 * implausible date before sending instead of hitting a database error.
 */
export function estDateEnregistrementPlausible(
  enregistreLe: Date | string,
  maintenant: Date = new Date(),
): boolean {
  const instant = enregistreLe instanceof Date ? enregistreLe.getTime() : Date.parse(enregistreLe)
  if (!Number.isFinite(instant)) return false
  const plusTard = maintenant.getTime() + MARGE_FUTUR_ENREGISTREMENT_MINUTES * 60_000
  const plusTot = maintenant.getTime() - AGE_MAX_ENREGISTREMENT_JOURS * 86_400_000
  return instant <= plusTard && instant >= plusTot
}

/** UTC offsets in use go from -12:00 to +14:00. */
const DecalageMinutesSchema = z.int().min(-720).max(840)

/** A row of `tentatives` as read back from the database. */
export const TentativeSchema = z.object({
  id: UuidSchema,
  utilisateur_id: UuidSchema,
  type: TypeTentativeSchema,
  etape_id: UuidSchema.nullable(),
  /** Set for a `duel` attempt (Phase 7). */
  duel_id: UuidSchema.nullable(),
  enregistre_le: IsoTimestampSchema,
  fuseau_horaire: IanaTimezoneSchema,
  decalage_minutes: DecalageMinutesSchema,
  duree_s: PgNumericSchema.nullable(),
  chemin_audio: z.string().nullable(),
  statut: StatutTentativeSchema,
  resultat: ResultatTentativeSchema.nullable(),
  essais_techniques: z.int().min(0),
  derniere_erreur: z.string().nullable(),
  audio_supprime_le: IsoTimestampSchema.nullable(),
  cree_le: IsoTimestampSchema,
  modifie_le: IsoTimestampSchema,
})
export type Tentative = z.output<typeof TentativeSchema>

/**
 * What the phone inserts once the audio is uploaded. The id is generated on the
 * phone before upload so that a retry is idempotent. RLS only accepts
 * `statut = 'envoyee'` and `utilisateur_id = auth.uid()`.
 */
export const NouvelleTentativeSchema = z
  .object({
    id: UuidSchema,
    utilisateur_id: UuidSchema,
    type: TypeTentativeSchema,
    etape_id: UuidSchema.nullable().default(null),
    duel_id: UuidSchema.nullable().default(null),
    enregistre_le: IsoTimestampSchema,
    fuseau_horaire: IanaTimezoneSchema,
    decalage_minutes: DecalageMinutesSchema,
    duree_s: z.number().min(0).max(9999.99).nullable().default(null),
    chemin_audio: z.string().min(1),
    statut: z.literal('envoyee').default('envoyee'),
  })
  .refine((t) => t.chemin_audio === cheminAudioTentative(t.utilisateur_id, t.id), {
    path: ['chemin_audio'],
    message: 'Le chemin audio doit être {utilisateur_id}/{id}.m4a',
  })
export type NouvelleTentative = z.output<typeof NouvelleTentativeSchema>
export type NouvelleTentativeEntree = z.input<typeof NouvelleTentativeSchema>
