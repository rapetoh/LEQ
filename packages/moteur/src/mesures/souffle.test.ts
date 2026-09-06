import { describe, expect, it } from 'vitest'
import { disposerMots } from '../fixtures/synthese.js'
import { mesurerSouffle } from './souffle.js'

describe('souffle', () => {
  it('groups words separated by at most 0.25 s into breath groups', () => {
    const { mots } = disposerMots(
      [
        { mots: ['a', 'b', 'c', 'd'], pause_apres_s: 0.26 },
        { mots: ['e', 'f'], pause_apres_s: 0.25 }, // exactly 0.25 does not break
        { mots: ['g'], pause_apres_s: 0.6 },
        { mots: ['h', 'i', 'j'], pause_apres_s: 0 },
      ],
      { duree_mot_s: 0.2, ecart_s: 0.1 },
    )
    const mesure = mesurerSouffle(mots)
    expect(mesure.segments_sans_pause.map((s) => s.mots)).toEqual([4, 3, 3])
    // first group: 4 words of 0.2 s and 3 gaps of 0.1 s
    expect(mesure.segments_sans_pause[0]).toEqual({ debut_s: 0, fin_s: 1.1, mots: 4 })
    // second group: e f (0.25 gap) g
    expect(mesure.segments_sans_pause[1]?.fin_s).toBeCloseTo(1.36 + 0.5 + 0.25 + 0.2, 3)
    expect(mesure.longueur_max_s).toBe(1.1)
  })

  it('handles empty input', () => {
    expect(mesurerSouffle([])).toEqual({ segments_sans_pause: [], longueur_max_s: 0 })
  })
})
