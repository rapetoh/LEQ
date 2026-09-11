// The server side of a take, seen from the phone: upload the audio, insert the row.
// Both steps are idempotent by attempt id, so a retry after a cut never duplicates.
import {
  BUCKET_AUDIO_TENTATIVES,
  cheminAudioTentative,
  NouvelleTentativeSchema,
} from '@leq/domaine'
import { File } from 'expo-file-system'

import type { EntreeFile } from './fileMachine'
import { supabase } from './supabase'

const TYPE_MIME = 'audio/mp4'

/** Storage answers 409 (or "already exists") when the object is there: the upload counts. */
export function estDejaPresent(
  erreur: { message?: string; statusCode?: string | number; status?: number } | null,
): boolean {
  if (!erreur) return false
  const code = String(erreur.statusCode ?? erreur.status ?? '')
  return code === '409' || /already exists|duplicate/i.test(erreur.message ?? '')
}

/** PostgREST answers 23505 when the row is there: the insert counts. */
export function estDoublon(erreur: { code?: string } | null): boolean {
  return erreur?.code === '23505'
}

export async function televerserPrise(entree: EntreeFile, utilisateurId: string): Promise<void> {
  if (!entree.chemin) throw new Error('Prise sans fichier')
  const chemin = cheminAudioTentative(utilisateurId, entree.id)
  const octets = await new File(entree.chemin).bytes()

  const envoi = await supabase.storage
    .from(BUCKET_AUDIO_TENTATIVES)
    .upload(chemin, octets, { contentType: TYPE_MIME, upsert: false })
  if (
    envoi.error &&
    !estDejaPresent(envoi.error as { message?: string; statusCode?: string | number })
  ) {
    throw new Error(`Envoi du fichier refusé : ${envoi.error.message}`)
  }

  const ligne = NouvelleTentativeSchema.parse({
    id: entree.id,
    utilisateur_id: utilisateurId,
    type: entree.type,
    etape_id: entree.etape_id,
    duel_id: entree.duel_id,
    enregistre_le: entree.enregistre_le,
    fuseau_horaire: entree.fuseau_horaire,
    decalage_minutes: entree.decalage_minutes,
    duree_s: entree.duree_s,
    chemin_audio: chemin,
  })
  const insertion = await supabase.from('tentatives').insert(ligne)
  if (insertion.error && !estDoublon(insertion.error)) {
    throw new Error(`Enregistrement de la prise refusé : ${insertion.error.message}`)
  }
}
