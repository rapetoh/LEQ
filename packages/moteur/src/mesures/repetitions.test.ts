import { describe, expect, it } from 'vitest'
import { construireMots } from '../fixtures/synthese.js'
import { mesurerRepetitions } from './repetitions.js'

describe('repetitions', () => {
  it('detects immediate repeats and multi-word restarts', () => {
    const mots = construireMots([
      ['je', 0, 0.1],
      ['je', 0.15, 0.25],
      ['pense', 0.3, 0.6],
      ['que', 0.65, 0.8],
      ['on', 1.0, 1.1],
      ['va,', 1.15, 1.3],
      ['on', 1.5, 1.6],
      ['va', 1.65, 1.8],
      ['réussir.', 1.85, 2.3],
    ])
    const mesure = mesurerRepetitions(mots)
    expect(mesure.total).toBe(2)
    expect(mesure.reprises).toBe(1)
    expect(mesure.occurrences).toEqual([
      { texte: 'je je', debut_s: 0 },
      { texte: 'on va on va', debut_s: 1.0 },
    ])
  })

  it('counts a triple repeat as one event and ignores reflexive doubles', () => {
    const mots = construireMots([
      ['la', 0, 0.1],
      ['la', 0.2, 0.3],
      ['la', 0.4, 0.5],
      ['nous', 0.6, 0.7],
      ['nous', 0.8, 0.9],
      ['sommes', 1.0, 1.3],
    ])
    const mesure = mesurerRepetitions(mots)
    expect(mesure.total).toBe(1)
    expect(mesure.occurrences[0]?.texte).toBe('la la')
  })

  it('is case and punctuation insensitive', () => {
    const mots = construireMots([
      ['Et', 0, 0.1],
      ['et,', 0.2, 0.3],
      ['puis', 0.4, 0.6],
    ])
    expect(mesurerRepetitions(mots).total).toBe(1)
  })

  it('returns zero on empty or clean input', () => {
    expect(mesurerRepetitions([])).toEqual({ total: 0, reprises: 0, occurrences: [] })
    const propre = construireMots([
      ['un', 0, 0.1],
      ['deux', 0.2, 0.3],
      ['trois', 0.4, 0.5],
    ])
    expect(mesurerRepetitions(propre).total).toBe(0)
  })
})
