/**
 * Filler words ("mots béquilles"), matched on the timed transcript.
 * Entries may span several words ("du coup", "tu vois"); matching is greedy, longest
 * entry first, on normalised tokens, so "du coup" is one occurrence of "du coup" and not
 * also one of "du". `par_type` only lists entries that occur at least once, keyed by the
 * entry as given in the list. `par_minute` is relative to the speaking time.
 */
import type { MotTranscrit } from '../domaine.js'
import { arrondirNombre } from '../stats.js'
import { normaliserMot, normaliserTexte } from '../texte.js'

/** Filler word list v1 from docs/DATA-MODEL.md. Rebecca edits it in Phase 6 (configuration). */
export const LISTE_BEQUILLES_V1: readonly string[] = [
  'euh',
  'du coup',
  'en fait',
  'genre',
  'voilà',
  'donc',
  'bah',
  'ben',
  'hein',
  'tu vois',
  'en gros',
  'enfin',
]

export interface OccurrenceBequille {
  mot: string
  debut_s: number
}

export interface MesureMotsBequilles {
  total: number
  par_minute: number
  par_type: Record<string, number>
  occurrences: OccurrenceBequille[]
}

interface Entree {
  cle: string
  jetons: string[]
}

export function mesurerMotsBequilles(
  mots: readonly MotTranscrit[],
  listeBequilles: readonly string[],
  duree_parole_s: number,
): MesureMotsBequilles {
  const entrees: Entree[] = listeBequilles
    .map((cle) => ({ cle, jetons: normaliserTexte(cle) }))
    .filter((e) => e.jetons.length > 0)
    .sort((a, b) => b.jetons.length - a.jetons.length)

  // One normalised token per transcript word; an elided word ("l'idée") keeps its space so it
  // can never match a filler entry, which is the intended behaviour.
  const jetons = mots.map((m) => normaliserMot(m.mot))
  const occurrences: OccurrenceBequille[] = []
  const par_type: Record<string, number> = {}

  let i = 0
  while (i < jetons.length) {
    let trouvee: Entree | null = null
    for (const entree of entrees) {
      const n = entree.jetons.length
      if (i + n > jetons.length) continue
      let ok = true
      for (let k = 0; k < n; k++) {
        if (jetons[i + k] !== entree.jetons[k]) {
          ok = false
          break
        }
      }
      if (ok) {
        trouvee = entree
        break
      }
    }
    if (trouvee === null) {
      i += 1
      continue
    }
    occurrences.push({
      mot: trouvee.cle,
      debut_s: arrondirNombre((mots[i] as MotTranscrit).debut_s, 3),
    })
    par_type[trouvee.cle] = (par_type[trouvee.cle] ?? 0) + 1
    i += trouvee.jetons.length
  }

  const total = occurrences.length
  const par_minute = duree_parole_s > 0 ? arrondirNombre((total * 60) / duree_parole_s, 2) : 0
  return { total, par_minute, par_type, occurrences }
}
