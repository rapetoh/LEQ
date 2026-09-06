/**
 * Silences: gaps between consecutive words strictly above 0.3 s. A gap of at least 1.0 s
 * is a held pause (`tenus`). The silence before the first word is `temps_avant_demarrage_s`
 * and is never counted here; the silence after the last word is not counted either.
 *
 * `place` comes from the sentence segmentation (punctuation, or gap length when the
 * transcript has no punctuation): `fin_de_phrase` after the last word of a sentence,
 * `debut` after the first word of a sentence (the speaker starts, then stops),
 * `milieu_de_phrase` otherwise.
 */
import type { MotTranscrit } from '../domaine.js'
import { arrondir, arrondirNombre } from '../stats.js'
import { decouperPhrases } from './phrases.js'

export const SEUIL_SILENCE_S = 0.3
export const SEUIL_SILENCE_TENU_S = 1.0

export type PlaceSilence = 'debut' | 'fin_de_phrase' | 'milieu_de_phrase'

export interface PositionSilence {
  debut_s: number
  duree_s: number
  place: PlaceSilence
}

export interface MesureSilences {
  total: number
  tenus: number
  duree_moyenne_s: number | null
  duree_max_s: number | null
  positions: PositionSilence[]
}

export function mesurerSilences(mots: readonly MotTranscrit[]): MesureSilences {
  const positions: PositionSilence[] = []
  const phrases = decouperPhrases(mots)
  const premierIndex = new Set(phrases.map((p) => p.index_debut))
  const dernierIndex = new Set(phrases.map((p) => p.index_fin))

  for (let i = 0; i + 1 < mots.length; i++) {
    const mot = mots[i] as MotTranscrit
    const suivant = mots[i + 1] as MotTranscrit
    // Word timestamps carry millisecond precision; rounding the gap keeps a pause of
    // exactly 0.3 s from reading as 0.30000000000000004 and slipping over the threshold.
    const duree = arrondirNombre(suivant.debut_s - mot.fin_s, 3)
    if (duree <= SEUIL_SILENCE_S) continue
    let place: PlaceSilence = 'milieu_de_phrase'
    if (dernierIndex.has(i)) place = 'fin_de_phrase'
    else if (premierIndex.has(i)) place = 'debut'
    positions.push({ debut_s: arrondirNombre(mot.fin_s, 3), duree_s: duree, place })
  }

  const durees = positions.map((p) => p.duree_s)
  const somme = durees.reduce((a, b) => a + b, 0)
  return {
    total: positions.length,
    tenus: positions.filter((p) => p.duree_s >= SEUIL_SILENCE_TENU_S).length,
    duree_moyenne_s: positions.length === 0 ? null : arrondir(somme / positions.length, 3),
    duree_max_s: positions.length === 0 ? null : arrondir(Math.max(...durees), 3),
    positions,
  }
}

/** Seconds before the first word; null when the transcript is empty. */
export function tempsAvantDemarrage(mots: readonly MotTranscrit[]): number | null {
  const premier = mots[0]
  return premier === undefined ? null : arrondirNombre(Math.max(0, premier.debut_s), 3)
}

/**
 * Speaking time: from the first word to the last word, minus the silences counted above.
 * Gaps of 0.3 s or less stay inside the speaking time (they are articulation, not pauses).
 */
export function dureeParole(mots: readonly MotTranscrit[], silences: MesureSilences): number {
  const premier = mots[0]
  const dernier = mots[mots.length - 1]
  if (premier === undefined || dernier === undefined) return 0
  const etendue = dernier.fin_s - premier.debut_s
  const pauses = silences.positions.reduce((a, p) => a + p.duree_s, 0)
  return arrondirNombre(Math.max(0, etendue - pauses), 3)
}
