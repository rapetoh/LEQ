/**
 * Volume from PCM: RMS per 50 ms frame converted to dBFS.
 * - `moyen_db` and `ecart_type_db` are computed over frames whose centre falls inside a
 *   transcript word, so silences do not drag the level down. Without a transcript, frames
 *   above -60 dBFS are used instead; with no such frame both are null.
 * - `chutes_fin_phrase` counts sentences whose last 400 ms average at least 6 dB below the
 *   sentence mean. Both means use speech frames only (frames inside the sentence's words),
 *   so the short gaps between words never count as a drop. Sentences shorter than 800 ms
 *   cannot be judged and are skipped; `ratio_chutes` divides by the sentences that were
 *   judged (null when none).
 */
import type { MotTranscrit } from '../domaine.js'
import { arrondir, dbfs, ecartType, moyenne } from '../stats.js'
import type { Pcm } from '../types.js'
import { decouperPhrases } from './phrases.js'

export const TRAME_VOLUME_S = 0.05
export const FIN_DE_PHRASE_S = 0.4
export const CHUTE_MIN_DB = 6
export const DUREE_MIN_PHRASE_JUGEE_S = 0.8
const PLANCHER_SANS_TRANSCRIPTION_DB = -60

export interface MesureVolume {
  moyen_db: number | null
  ecart_type_db: number | null
  chutes_fin_phrase: number
  ratio_chutes: number | null
}

/** dBFS level of every 50 ms frame, frame i covering [i * 0.05 s, (i + 1) * 0.05 s). */
export function niveauxParTrame(pcm: Pcm, trame_s = TRAME_VOLUME_S): number[] {
  const parTrame = Math.max(1, Math.round(trame_s * pcm.frequence_hz))
  const n = Math.floor(pcm.echantillons.length / parTrame)
  const niveaux = new Array<number>(n)
  for (let i = 0; i < n; i++) niveaux[i] = dbfs(pcm.echantillons, i * parTrame, (i + 1) * parTrame)
  return niveaux
}

interface TrameNiveau {
  centre_s: number
  db: number
}

/** Frames whose centre falls inside [debut_s, fin_s]. */
function tramesDans(
  niveaux: readonly number[],
  debut_s: number,
  fin_s: number,
  trame_s: number,
): TrameNiveau[] {
  const sortie: TrameNiveau[] = []
  const premiere = Math.max(0, Math.floor(debut_s / trame_s))
  const derniere = Math.min(niveaux.length - 1, Math.ceil(fin_s / trame_s))
  for (let i = premiere; i <= derniere; i++) {
    const centre_s = (i + 0.5) * trame_s
    if (centre_s >= debut_s && centre_s <= fin_s)
      sortie.push({ centre_s, db: niveaux[i] as number })
  }
  return sortie
}

/** Speech frames of a word list: frames inside any of the words, in time order, no duplicate. */
function tramesParlees(
  niveaux: readonly number[],
  mots: readonly MotTranscrit[],
  trame_s: number,
): TrameNiveau[] {
  const vues = new Set<number>()
  const sortie: TrameNiveau[] = []
  for (const mot of mots) {
    for (const trame of tramesDans(niveaux, mot.debut_s, mot.fin_s, trame_s)) {
      if (vues.has(trame.centre_s)) continue
      vues.add(trame.centre_s)
      sortie.push(trame)
    }
  }
  return sortie
}

export function mesurerVolume(pcm: Pcm, mots: readonly MotTranscrit[]): MesureVolume {
  const niveaux = niveauxParTrame(pcm)
  const trame_s = TRAME_VOLUME_S

  const parles =
    mots.length > 0
      ? tramesParlees(niveaux, mots, trame_s).map((t) => t.db)
      : niveaux.filter((n) => n > PLANCHER_SANS_TRANSCRIPTION_DB)

  let chutes = 0
  let jugees = 0
  for (const phrase of decouperPhrases(mots)) {
    if (phrase.fin_s - phrase.debut_s < DUREE_MIN_PHRASE_JUGEE_S) continue
    const corps = tramesParlees(niveaux, phrase.mots, trame_s)
    const fin = corps.filter((t) => t.centre_s >= phrase.fin_s - FIN_DE_PHRASE_S)
    const moyCorps = moyenne(corps.map((t) => t.db))
    const moyFin = moyenne(fin.map((t) => t.db))
    if (moyCorps === null || moyFin === null) continue
    jugees += 1
    if (moyFin <= moyCorps - CHUTE_MIN_DB) chutes += 1
  }

  return {
    moyen_db: arrondir(moyenne(parles), 2),
    ecart_type_db: arrondir(ecartType(parles), 2),
    chutes_fin_phrase: chutes,
    ratio_chutes: jugees === 0 ? null : arrondir(chutes / jugees, 3),
  }
}
