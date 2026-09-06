/**
 * Repetitions and restarts on the timed transcript.
 * - a repetition is a token immediately repeated ("je je");
 * - a restart ("reprise") is a group of 2 or 3 tokens immediately repeated ("on va, on va").
 * `total` counts both kinds, `reprises` only the multi-word ones. Matching is greedy on the
 * longest group first and skips the whole doubled group, so "je je je" is one event.
 * Doubled forms that are correct French ("nous nous", "vous vous") are ignored.
 */
import type { MotTranscrit } from '../domaine.js'
import { arrondirNombre } from '../stats.js'
import { normaliserMot } from '../texte.js'

export const LONGUEUR_MAX_REPRISE = 3

/** Doubled pronouns of reflexive verbs, correct French, never a repetition. */
const DOUBLONS_LEGITIMES: ReadonlySet<string> = new Set(['nous', 'vous'])

export interface OccurrenceRepetition {
  texte: string
  debut_s: number
}

export interface MesureRepetitions {
  total: number
  reprises: number
  occurrences: OccurrenceRepetition[]
}

export function mesurerRepetitions(mots: readonly MotTranscrit[]): MesureRepetitions {
  const jetons = mots.map((m) => normaliserMot(m.mot))
  const occurrences: OccurrenceRepetition[] = []
  let reprises = 0

  let i = 0
  while (i < jetons.length) {
    let longueur = 0
    for (let n = LONGUEUR_MAX_REPRISE; n >= 1; n--) {
      if (i + 2 * n > jetons.length) continue
      let ok = true
      for (let k = 0; k < n; k++) {
        const a = jetons[i + k] as string
        if (a.length === 0 || a !== jetons[i + n + k]) {
          ok = false
          break
        }
      }
      if (ok && n === 1 && DOUBLONS_LEGITIMES.has(jetons[i] as string)) ok = false
      if (ok) {
        longueur = n
        break
      }
    }
    if (longueur === 0) {
      i += 1
      continue
    }
    const texte = jetons.slice(i, i + 2 * longueur).join(' ')
    occurrences.push({ texte, debut_s: arrondirNombre((mots[i] as MotTranscrit).debut_s, 3) })
    if (longueur >= 2) reprises += 1
    i += 2 * longueur
  }

  return { total: occurrences.length, reprises, occurrences }
}
