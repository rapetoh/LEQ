// C8 · The end of an Arena week, seen as a podium. Pure arithmetic over the ranking, so the
// screen holds no logic and the awkward cases (a week with one speaker, a tie on votes, a
// person who did not speak) are checked in a test rather than in the hand.
import type { LigneClassement } from '@leq/domaine'

/** A step of the podium. `ligne` is null when nobody took that place. */
export type Marche = { rang: 1 | 2 | 3; ligne: LigneClassement | null }

/**
 * The three steps in the order they are drawn: second on the left, first in the middle,
 * third on the right, the way a podium stands.
 */
export function marches(classement: readonly LigneClassement[]): [Marche, Marche, Marche] {
  const a = (rang: 1 | 2 | 3): Marche => ({
    rang,
    ligne: classement.find((ligne) => ligne.rang === rang) ?? null,
  })
  return [a(2), a(1), a(3)]
}

/** Everyone below the podium, in order. */
export function reste(classement: readonly LigneClassement[]): LigneClassement[] {
  return classement.filter((ligne) => ligne.rang > 3)
}

/** The caller's own line, when they spoke that week. */
export function maLigne(classement: readonly LigneClassement[]): LigneClassement | null {
  return classement.find((ligne) => ligne.moi) ?? null
}

/** Relative heights of the three steps, as a share of the tallest. */
export const HAUTEURS: Record<1 | 2 | 3, number> = { 1: 1, 2: 0.72, 3: 0.54 }
