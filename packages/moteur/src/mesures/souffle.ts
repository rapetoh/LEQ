/**
 * Breath groups: runs of consecutive words with no gap above 0.25 s between them.
 * The longest run is the longest stretch spoken without a breath.
 */
import type { MotTranscrit } from '../domaine.js'
import { arrondirNombre } from '../stats.js'

export const SEUIL_RESPIRATION_S = 0.25

export interface SegmentSansPause {
  debut_s: number
  fin_s: number
  mots: number
}

export interface MesureSouffle {
  segments_sans_pause: SegmentSansPause[]
  longueur_max_s: number
}

export function mesurerSouffle(mots: readonly MotTranscrit[]): MesureSouffle {
  const segments: SegmentSansPause[] = []
  let debut = 0
  for (let i = 0; i < mots.length; i++) {
    const mot = mots[i] as MotTranscrit
    const suivant = mots[i + 1]
    const coupe =
      suivant === undefined || arrondirNombre(suivant.debut_s - mot.fin_s, 3) > SEUIL_RESPIRATION_S
    if (coupe) {
      segments.push({
        debut_s: arrondirNombre((mots[debut] as MotTranscrit).debut_s, 3),
        fin_s: arrondirNombre(mot.fin_s, 3),
        mots: i - debut + 1,
      })
      debut = i + 1
    }
  }
  let max = 0
  for (const s of segments) max = Math.max(max, s.fin_s - s.debut_s)
  return { segments_sans_pause: segments, longueur_max_s: arrondirNombre(max, 3) }
}
