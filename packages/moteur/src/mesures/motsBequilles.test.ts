import { describe, expect, it } from 'vitest'
import { construireMots } from '../fixtures/synthese.js'
import { LISTE_BEQUILLES_V1, mesurerMotsBequilles } from './motsBequilles.js'

describe('motsBequilles', () => {
  it('matches single and multi-word fillers with their time', () => {
    const mots = construireMots([
      ['Euh,', 0, 0.3],
      ['du', 0.4, 0.5],
      ['coup', 0.55, 0.8],
      ['je', 0.9, 1.0],
      ['pense', 1.05, 1.4],
      ['que,', 1.45, 1.6],
      ['en', 1.7, 1.8],
      ['fait,', 1.85, 2.1],
      ['tu', 2.2, 2.3],
      ['vois,', 2.35, 2.6],
      ['ça', 2.7, 2.8],
      ['marche.', 2.85, 3.2],
      ['Euh', 3.5, 3.7],
    ])
    const mesure = mesurerMotsBequilles(mots, LISTE_BEQUILLES_V1, 60)
    expect(mesure.total).toBe(5)
    expect(mesure.par_type).toEqual({ euh: 2, 'du coup': 1, 'en fait': 1, 'tu vois': 1 })
    expect(mesure.occurrences).toEqual([
      { mot: 'euh', debut_s: 0 },
      { mot: 'du coup', debut_s: 0.4 },
      { mot: 'en fait', debut_s: 1.7 },
      { mot: 'tu vois', debut_s: 2.2 },
      { mot: 'euh', debut_s: 3.5 },
    ])
    expect(mesure.par_minute).toBe(5)
  })

  it('does not count "du" alone or an elided form', () => {
    const mots = construireMots([
      ['le', 0, 0.1],
      ['du', 0.2, 0.3],
      ['pain', 0.4, 0.6],
      ["d'euh", 0.7, 0.9],
    ])
    const mesure = mesurerMotsBequilles(mots, LISTE_BEQUILLES_V1, 30)
    expect(mesure.total).toBe(0)
    expect(mesure.par_type).toEqual({})
  })

  it('scales per minute on the speaking time and survives a zero duration', () => {
    const mots = construireMots([['euh', 0, 0.2]])
    expect(mesurerMotsBequilles(mots, ['euh'], 30).par_minute).toBe(2)
    expect(mesurerMotsBequilles(mots, ['euh'], 0).par_minute).toBe(0)
  })

  it('accepts a custom list with accents and capitals', () => {
    const mots = construireMots([
      ['Voilà,', 0, 0.2],
      ['ENFIN', 0.3, 0.5],
    ])
    const mesure = mesurerMotsBequilles(mots, ['Voilà', 'enfin'], 60)
    expect(mesure.par_type).toEqual({ Voilà: 1, enfin: 1 })
  })
})
