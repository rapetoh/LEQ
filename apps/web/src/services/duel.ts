/**
 * The duel, seen from the public page. Every rule lives in the database functions of the
 * migrations `arene` and `duel_invite_anonyme`; this file only calls them and validates what
 * comes back with the shared schemas of @leq/domaine.
 *
 * Order of the gestures, and it matters: the slot is claimed (rejoindre_duel) before the person
 * speaks, so a refusal is said before ninety seconds of effort, not after.
 */
import {
  BUCKET_AUDIO_TENTATIVES,
  cheminAudioTentative,
  DuelParJetonSchema,
  DuelSchema,
  estStatutTentativeFinal,
  lireRefusArene,
  NouvelleTentativeSchema,
  StatutTentativeSchema,
  type Duel,
  type DuelParJeton,
  type RefusArene,
  type StatutTentative,
} from '@leq/domaine'
import { z } from 'zod'

import { fr } from '../fr'
import { connecterAnonymement, supabase } from '../supabase'
import type { PriseEnregistree } from './enregistrement'

export type { Duel, DuelParJeton }

export class ErreurDuel extends Error {
  constructor(
    readonly refus: RefusArene | null,
    message: string,
  ) {
    super(message)
  }
}

function echouer(message: string): never {
  throw new ErreurDuel(lireRefusArene(message), message)
}

/** The sentence to show for a refusal of the database. Titles and details stay together. */
export function messageRefus(erreur: unknown): { titre: string; detail: string } {
  const refus = erreur instanceof ErreurDuel ? erreur.refus : null
  switch (refus) {
    case 'duel_clos':
      return { titre: fr.duel.closTitre, detail: fr.duel.closDetail }
    case 'duel_expire':
      return { titre: fr.duel.expireTitre, detail: fr.duel.expireDetail }
    case 'duel_complet':
      return { titre: fr.duel.completTitre, detail: fr.duel.completDetail }
    case 'duel_sur_soi':
      return { titre: fr.duel.surSoiTitre, detail: fr.duel.surSoiDetail }
    case 'duel_introuvable':
      return { titre: fr.duel.introuvable, detail: fr.duel.introuvableDetail }
    default:
      return { titre: fr.duel.erreur, detail: fr.commun.reessayer }
  }
}

/** Reads the invitation. Answers the subject and the deadline only, never the other take. */
export async function lireInvitation(jeton: string): Promise<DuelParJeton> {
  const { data, error } = await supabase.rpc('lire_duel_par_jeton', { p_jeton: jeton })
  if (error) echouer(error.message)
  return DuelParJetonSchema.parse(data)
}

/** Signs in anonymously and claims the invitee's seat. Answers the duel id. */
export async function rejoindre(jeton: string): Promise<string> {
  await connecterAnonymement()
  const { data, error } = await supabase.rpc('rejoindre_duel', { p_jeton: jeton })
  if (error) echouer(error.message)
  return z.uuid().parse(data)
}

/**
 * The duel, read once the seat is claimed: this is where the verdict appears. Only the two
 * columns the page shows are read, so a later column never breaks this page.
 */
const IssueDuelSchema = DuelSchema.pick({ statut: true, verdict: true })
export type IssueDuel = z.output<typeof IssueDuelSchema>

export async function lireIssue(duelId: string): Promise<IssueDuel> {
  const { data, error } = await supabase
    .from('duels')
    .select('statut, verdict')
    .eq('id', duelId)
    .single()
  if (error) echouer(error.message)
  return IssueDuelSchema.parse(data)
}

/**
 * Uploads the audio and inserts the attempt. Both steps are keyed by the attempt id, so a
 * retry after a cut never duplicates anything.
 *
 * The object is named `.m4a` because the storage policy of the socle migration only accepts
 * that shape; the bytes are whatever the browser wrote (mp4 or webm), and the worker decodes
 * by probing the content.
 */
export async function envoyerPrise(options: {
  duelId: string
  prise: PriseEnregistree
  tentativeId: string
}): Promise<string> {
  const { duelId, prise, tentativeId } = options
  const utilisateurId = await connecterAnonymement()
  const chemin = cheminAudioTentative(utilisateurId, tentativeId)

  const envoi = await supabase.storage
    .from(BUCKET_AUDIO_TENTATIVES)
    .upload(chemin, prise.blob, { contentType: prise.typeMime, upsert: false })
  if (envoi.error && !estDejaPresent(envoi.error)) {
    echouer(`Envoi du fichier refusé : ${envoi.error.message}`)
  }

  const maintenant = new Date()
  const ligne = NouvelleTentativeSchema.parse({
    id: tentativeId,
    utilisateur_id: utilisateurId,
    type: 'duel',
    duel_id: duelId,
    enregistre_le: maintenant.toISOString(),
    fuseau_horaire: Intl.DateTimeFormat().resolvedOptions().timeZone,
    decalage_minutes: -maintenant.getTimezoneOffset(),
    duree_s: Math.round(prise.dureeS * 100) / 100,
    chemin_audio: chemin,
  })
  const insertion = await supabase.from('tentatives').insert(ligne)
  if (insertion.error && insertion.error.code !== '23505') {
    echouer(`Enregistrement de la prise refusé : ${insertion.error.message}`)
  }
  return tentativeId
}

/** Storage answers 409 when the object is already there: the upload counts. */
function estDejaPresent(erreur: unknown): boolean {
  const details = erreur as { message?: string; statusCode?: string | number } | null
  const code = String(details?.statusCode ?? '')
  return code === '409' || /already exists|duplicate/i.test(details?.message ?? '')
}

export async function lireStatutTentative(tentativeId: string): Promise<StatutTentative | null> {
  const { data, error } = await supabase
    .from('tentatives')
    .select('statut')
    .eq('id', tentativeId)
    .maybeSingle()
  if (error) echouer(error.message)
  const statut = (data as { statut?: unknown } | null)?.statut
  return statut === undefined || statut === null ? null : StatutTentativeSchema.parse(statut)
}

/** Makes the analysed take public: the deliberate gesture of chapter 11. */
export async function publier(tentativeId: string): Promise<void> {
  const { error } = await supabase.rpc('publier_prise', { p_tentative_id: tentativeId })
  if (error) echouer(error.message)
}

export { estStatutTentativeFinal }
