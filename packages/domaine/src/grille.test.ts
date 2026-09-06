import { describe, expect, it } from 'vitest'
import {
  evaluerCriteres,
  evaluerRegle,
  lireMesure,
  RegleCritereSchema,
  type RegleCritere,
} from './grille.js'

const regleDebit: RegleCritere = {
  version: 1,
  score_max: 10,
  elements: [
    {
      mesure: 'debit.mots_par_minute',
      poids: 1,
      bandes: [
        { min: null, max: 110, score: 4 },
        { min: 110, max: 130, score: 7 },
        { min: 130, max: 150, score: 10 },
        { min: 150, max: 170, score: 7 },
        { min: 170, max: null, score: 4 },
      ],
    },
  ],
}

describe('lireMesure', () => {
  it('reads a nested numeric leaf', () => {
    expect(lireMesure({ debit: { mots_par_minute: 142 } }, 'debit.mots_par_minute')).toBe(142)
  })
  it('returns null for missing, null, non-numeric or array values', () => {
    expect(lireMesure({}, 'debit.mots_par_minute')).toBeNull()
    expect(lireMesure({ debit: null }, 'debit.mots_par_minute')).toBeNull()
    expect(lireMesure({ debit: { mots_par_minute: 'x' } }, 'debit.mots_par_minute')).toBeNull()
    expect(lireMesure({ debit: [142] }, 'debit.0')).toBeNull()
    expect(lireMesure(null, 'debit')).toBeNull()
  })
})

describe('evaluerRegle', () => {
  it('scores the band that contains the value, min inclusive, max exclusive', () => {
    expect(evaluerRegle(regleDebit, { debit: { mots_par_minute: 142 } }).score).toBe(10)
    expect(evaluerRegle(regleDebit, { debit: { mots_par_minute: 130 } }).score).toBe(10)
    expect(evaluerRegle(regleDebit, { debit: { mots_par_minute: 150 } }).score).toBe(7)
    expect(evaluerRegle(regleDebit, { debit: { mots_par_minute: 30 } }).score).toBe(4)
  })

  it('normalises a weighted sum to score_max', () => {
    const regle: RegleCritere = {
      version: 1,
      score_max: 10,
      elements: [
        { mesure: 'a', poids: 3, bandes: [{ min: null, max: null, score: 2 }] },
        {
          mesure: 'b',
          poids: 1,
          bandes: [
            { min: 0, max: 1, score: 0 },
            { min: 1, max: null, score: 4 },
          ],
        },
      ],
    }
    // a scores 2/2 with weight 3, b scores 0/4 with weight 1: (6 + 0) / (6 + 4) = 0.6
    expect(evaluerRegle(regle, { a: 5, b: 0.5 }).score).toBe(6)
    expect(evaluerRegle(regle, { a: 5, b: 2 }).score).toBe(10)
  })

  it('never throws on a missing measure and flags it, keeping its weight in the denominator', () => {
    const resultat = evaluerRegle(regleDebit, { debit: { mots_par_minute: null } })
    expect(resultat.score).toBe(0)
    expect(resultat.details[0]?.manquante).toBe(true)
    expect(evaluerRegle(regleDebit, undefined).score).toBe(0)
  })

  it('flags a value outside every band', () => {
    const regle: RegleCritere = {
      version: 1,
      score_max: 5,
      elements: [{ mesure: 'x', poids: 1, bandes: [{ min: 0, max: 1, score: 5 }] }],
    }
    const resultat = evaluerRegle(regle, { x: 3 })
    expect(resultat.score).toBe(0)
    expect(resultat.details[0]?.hors_bandes).toBe(true)
  })
})

describe('evaluerCriteres', () => {
  it('assembles sous_notes and the total', () => {
    const resultat = evaluerCriteres(
      [
        { cle: 'rythme', regle: regleDebit },
        { cle: 'silence', regle: { ...regleDebit, score_max: 5 } },
      ],
      { debit: { mots_par_minute: 142 } },
    )
    expect(resultat.sous_notes).toEqual({
      rythme: { score: 10, max: 10 },
      silence: { score: 5, max: 5 },
    })
    expect(resultat.note_totale).toBe(15)
    expect(resultat.max_total).toBe(15)
  })
})

describe('RegleCritereSchema', () => {
  it('rejects a band whose min exceeds its max', () => {
    const resultat = RegleCritereSchema.safeParse({
      version: 1,
      score_max: 10,
      elements: [{ mesure: 'x', poids: 1, bandes: [{ min: 5, max: 1, score: 1 }] }],
    })
    expect(resultat.success).toBe(false)
  })
})
