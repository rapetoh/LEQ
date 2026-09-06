/**
 * Pitch statistics on the F0 track, in semitones relative to the median so that a low and
 * a high voice with the same intonation get the same numbers.
 * - voiced frames: non-null F0 within [50, 600] Hz (outside is an extractor artefact);
 * - `plage_demi_tons`: 5th to 95th percentile spread, robust to octave jumps;
 * - `ratio_voise`: voiced frames over the frames of the spoken span when one is given,
 *   over the whole track otherwise.
 * Everything is null on a take without a single voiced frame.
 */
import { arrondir, ecartType, mediane, percentile } from '../stats.js'
import type { Intervalle, PistesProsodie } from '../types.js'

export const F0_MIN_HZ = 50
export const F0_MAX_HZ = 600

export interface MesureHauteur {
  f0_median_hz: number | null
  f0_ecart_type_demi_tons: number | null
  plage_demi_tons: number | null
  ratio_voise: number | null
}

export function mesurerHauteur(prosodie: PistesProsodie, etendue?: Intervalle): MesureHauteur {
  const { pas_s, f0_hz } = prosodie
  const premiere = etendue ? Math.max(0, Math.floor(etendue.debut_s / pas_s)) : 0
  const derniere = etendue ? Math.min(f0_hz.length, Math.ceil(etendue.fin_s / pas_s)) : f0_hz.length

  const voisees: number[] = []
  let considerees = 0
  for (let i = premiere; i < derniere; i++) {
    considerees += 1
    const f = f0_hz[i]
    if (f !== null && f !== undefined && f >= F0_MIN_HZ && f <= F0_MAX_HZ) voisees.push(f)
  }
  if (voisees.length === 0 || considerees === 0) {
    return {
      f0_median_hz: null,
      f0_ecart_type_demi_tons: null,
      plage_demi_tons: null,
      ratio_voise: null,
    }
  }

  const median = mediane(voisees) as number
  const demiTons = voisees.map((f) => 12 * Math.log2(f / median))
  const p5 = percentile(demiTons, 5) as number
  const p95 = percentile(demiTons, 95) as number
  return {
    f0_median_hz: arrondir(median, 1),
    f0_ecart_type_demi_tons: arrondir(ecartType(demiTons), 2),
    plage_demi_tons: arrondir(p95 - p5, 2),
    ratio_voise: arrondir(voisees.length / considerees, 3),
  }
}
