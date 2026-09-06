/**
 * Word error rate with French normalisation (see texte.ts): lowercase, punctuation and
 * apostrophes removed, accents kept, digits kept. Levenshtein distance on tokens.
 */
import { normaliserTexte } from './texte.js'

export interface ResultatWer {
  /** (substitutions + insertions + suppressions) / reference words. 0 when both are empty, 1 when only the reference is empty. */
  wer: number
  substitutions: number
  insertions: number
  suppressions: number
  mots_reference: number
  mots_hypothese: number
}

export function calculerWer(reference: string, hypothese: string): ResultatWer {
  const ref = normaliserTexte(reference)
  const hyp = normaliserTexte(hypothese)
  const n = ref.length
  const m = hyp.length

  // d[i][j] = cost to turn ref[0..i) into hyp[0..j); we also track the edit kinds.
  const cout: number[][] = []
  for (let i = 0; i <= n; i++) {
    const ligne = new Array<number>(m + 1)
    ligne[0] = i
    cout.push(ligne)
  }
  for (let j = 0; j <= m; j++) (cout[0] as number[])[j] = j
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const egal = ref[i - 1] === hyp[j - 1] ? 0 : 1
      const sub = (cout[i - 1] as number[])[j - 1] as number
      const sup = (cout[i - 1] as number[])[j] as number
      const ins = (cout[i] as number[])[j - 1] as number
      ;(cout[i] as number[])[j] = Math.min(sub + egal, sup + 1, ins + 1)
    }
  }

  // Backtrace to count each kind of edit.
  let substitutions = 0
  let insertions = 0
  let suppressions = 0
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    const actuel = (cout[i] as number[])[j] as number
    if (i > 0 && j > 0) {
      const egal = ref[i - 1] === hyp[j - 1] ? 0 : 1
      if (actuel === ((cout[i - 1] as number[])[j - 1] as number) + egal) {
        if (egal === 1) substitutions += 1
        i -= 1
        j -= 1
        continue
      }
    }
    if (i > 0 && actuel === ((cout[i - 1] as number[])[j] as number) + 1) {
      suppressions += 1
      i -= 1
      continue
    }
    insertions += 1
    j -= 1
  }

  const erreurs = substitutions + insertions + suppressions
  const wer = n === 0 ? (m === 0 ? 0 : 1) : erreurs / n
  return { wer, substitutions, insertions, suppressions, mots_reference: n, mots_hypothese: m }
}
