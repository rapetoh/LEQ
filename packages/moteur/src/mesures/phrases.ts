/**
 * Sentence segmentation and the `phrases` measure family.
 * Split on sentence punctuation carried by the transcript words; when the transcript has
 * no punctuation at all (some providers return none), split on gaps above 1.0 s instead.
 */
import type { MotTranscrit } from '../domaine.js'
import { arrondirNombre } from '../stats.js'
import { termineUnePhrase } from '../texte.js'

/** A gap between two consecutive words strictly above this, without punctuation, splits a sentence. */
export const SEUIL_COUPURE_SANS_PONCTUATION_S = 1.0

export interface Phrase {
  /** Index of the first word in the transcript. */
  index_debut: number
  /** Index of the last word in the transcript (inclusive). */
  index_fin: number
  debut_s: number
  fin_s: number
  mots: MotTranscrit[]
}

export interface MesurePhrases {
  nombre: number
  longueur_moyenne_mots: number
  longueur_max_mots: number
}

export function transcriptionPonctuee(mots: readonly MotTranscrit[]): boolean {
  return mots.some((m) => termineUnePhrase(m.mot))
}

export function decouperPhrases(mots: readonly MotTranscrit[]): Phrase[] {
  const phrases: Phrase[] = []
  if (mots.length === 0) return phrases
  const surPonctuation = transcriptionPonctuee(mots)
  let debut = 0
  for (let i = 0; i < mots.length; i++) {
    const mot = mots[i] as MotTranscrit
    const suivant = mots[i + 1]
    let coupe = suivant === undefined
    if (!coupe) {
      if (surPonctuation) coupe = termineUnePhrase(mot.mot)
      else
        coupe =
          arrondirNombre((suivant as MotTranscrit).debut_s - mot.fin_s, 3) >
          SEUIL_COUPURE_SANS_PONCTUATION_S
    }
    if (coupe) {
      const tranche = mots.slice(debut, i + 1)
      phrases.push({
        index_debut: debut,
        index_fin: i,
        debut_s: (tranche[0] as MotTranscrit).debut_s,
        fin_s: mot.fin_s,
        mots: tranche,
      })
      debut = i + 1
    }
  }
  return phrases
}

export function mesurerPhrases(mots: readonly MotTranscrit[]): MesurePhrases {
  const phrases = decouperPhrases(mots)
  if (phrases.length === 0) return { nombre: 0, longueur_moyenne_mots: 0, longueur_max_mots: 0 }
  let total = 0
  let max = 0
  for (const p of phrases) {
    total += p.mots.length
    if (p.mots.length > max) max = p.mots.length
  }
  return {
    nombre: phrases.length,
    longueur_moyenne_mots: arrondirNombre(total / phrases.length, 2),
    longueur_max_mots: max,
  }
}
