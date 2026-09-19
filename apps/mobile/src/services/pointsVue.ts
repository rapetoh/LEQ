// Pure presentation of the points tile of B1: what `mes_points()` becomes on the home screen.
// Tested without React.
import type { Points } from '@leq/domaine'

export type EtatSemaine = 'gain' | 'vide' | 'aucun'

/**
 * What the tile says about the last seven days. A week that paid nothing is not the same thing
 * as an account that has never been paid: the second is told where points come from, the first
 * is told its week, and someone with three hundred points never reads that theirs are about to
 * start.
 */
export function etatSemaine(points: Points | undefined): EtatSemaine {
  if (!points) return 'aucun'
  if (points.cette_semaine > 0) return 'gain'
  return points.cumul > 0 ? 'vide' : 'aucun'
}
