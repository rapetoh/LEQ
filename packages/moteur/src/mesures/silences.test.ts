import { describe, expect, it } from 'vitest'
import { disposerMots } from '../fixtures/synthese.js'
import { dureeParole, mesurerSilences, tempsAvantDemarrage } from './silences.js'

describe('silences', () => {
  it('counts gaps above 0.3 s, held pauses at 1.0 s, and places them', () => {
    const { mots } = disposerMots(
      [
        { mots: ['Alors'], pause_apres_s: 0.5 }, // after the first word of the sentence: debut
        { mots: ['on', 'commence'], pause_apres_s: 0.4 }, // mid sentence
        { mots: ['maintenant.'], pause_apres_s: 1.2 }, // end of sentence, held
        { mots: ['Deuxième', 'phrase'], pause_apres_s: 0.3 }, // exactly 0.3: not a silence
        { mots: ['courte.'], pause_apres_s: 1.0 }, // end of sentence, held (1.0 counts)
        { mots: ['Fin.'], pause_apres_s: 0 },
      ],
      { debut_s: 2.0 },
    )
    const mesure = mesurerSilences(mots)
    expect(mesure.total).toBe(4)
    expect(mesure.tenus).toBe(2)
    expect(mesure.positions.map((p) => p.place)).toEqual([
      'debut',
      'milieu_de_phrase',
      'fin_de_phrase',
      'fin_de_phrase',
    ])
    expect(mesure.positions.map((p) => p.duree_s)).toEqual([0.5, 0.4, 1.2, 1.0])
    expect(mesure.duree_max_s).toBe(1.2)
    expect(mesure.duree_moyenne_s).toBeCloseTo(0.775, 3)
    expect(mesure.positions[0]?.debut_s).toBe(2.3)
  })

  it('counts leading silence as start delay, never as a silence', () => {
    const { mots } = disposerMots([{ mots: ['Bonjour', 'à', 'tous.'], pause_apres_s: 3 }], {
      debut_s: 1.8,
    })
    expect(tempsAvantDemarrage(mots)).toBe(1.8)
    expect(mesurerSilences(mots).total).toBe(0)
  })

  it('returns nulls on an empty transcript', () => {
    const mesure = mesurerSilences([])
    expect(mesure).toEqual({
      total: 0,
      tenus: 0,
      duree_moyenne_s: null,
      duree_max_s: null,
      positions: [],
    })
    expect(tempsAvantDemarrage([])).toBeNull()
    expect(dureeParole([], mesure)).toBe(0)
  })

  it('computes speaking time as span minus counted silences', () => {
    const { mots, fin_s } = disposerMots(
      [
        { mots: ['un', 'deux'], pause_apres_s: 0.8 },
        { mots: ['trois.'], pause_apres_s: 0 },
      ],
      { debut_s: 1.0, duree_mot_s: 0.3, ecart_s: 0.1 },
    )
    // 'un' 1.0-1.3, 'deux' 1.4-1.7, pause 0.8, 'trois.' 2.5-2.8: span 1.8 s, one 0.8 s silence
    const mesure = mesurerSilences(mots)
    expect(fin_s).toBe(2.8)
    expect(mesure.total).toBe(1)
    expect(dureeParole(mots, mesure)).toBeCloseTo(1.8 - 0.8, 3)
  })
})
