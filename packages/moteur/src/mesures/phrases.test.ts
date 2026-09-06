import { describe, expect, it } from 'vitest'
import { construireMots, disposerMots } from '../fixtures/synthese.js'
import { decouperPhrases, mesurerPhrases } from './phrases.js'

describe('phrases', () => {
  it('splits on sentence punctuation', () => {
    const mots = construireMots([
      ['Bonjour', 0, 0.3],
      ['à', 0.35, 0.4],
      ['tous.', 0.45, 0.8],
      ['Merci', 1.0, 1.3],
      ['beaucoup', 1.35, 1.8],
      ['!', 1.8, 1.8],
      ['Ça', 2.0, 2.2],
      ['va', 2.25, 2.4],
      ['?', 2.4, 2.4],
      ['Oui', 2.6, 2.9],
    ])
    const phrases = decouperPhrases(mots)
    expect(phrases.map((p) => p.mots.length)).toEqual([3, 3, 3, 1])
    expect(phrases[0]).toMatchObject({ index_debut: 0, index_fin: 2, debut_s: 0, fin_s: 0.8 })
    const mesure = mesurerPhrases(mots)
    expect(mesure).toEqual({ nombre: 4, longueur_moyenne_mots: 2.5, longueur_max_mots: 3 })
  })

  it('falls back on gaps above 1.0 s when the transcript has no punctuation', () => {
    const { mots } = disposerMots([
      { mots: ['on', 'commence', 'ici'], pause_apres_s: 0.9 },
      { mots: ['et', 'on', 'continue'], pause_apres_s: 1.01 },
      { mots: ['puis', 'on', 'finit', 'là'], pause_apres_s: 0 },
    ])
    const phrases = decouperPhrases(mots)
    expect(phrases.map((p) => p.mots.length)).toEqual([6, 4])
    expect(mesurerPhrases(mots)).toEqual({
      nombre: 2,
      longueur_moyenne_mots: 5,
      longueur_max_mots: 6,
    })
  })

  it('ignores long gaps when punctuation exists', () => {
    const { mots } = disposerMots([
      { mots: ['on', 'commence'], pause_apres_s: 2.0 },
      { mots: ['et', 'on', 'finit.'], pause_apres_s: 0 },
    ])
    expect(decouperPhrases(mots)).toHaveLength(1)
  })

  it('handles an empty transcript', () => {
    expect(decouperPhrases([])).toEqual([])
    expect(mesurerPhrases([])).toEqual({
      nombre: 0,
      longueur_moyenne_mots: 0,
      longueur_max_mots: 0,
    })
  })

  it('treats a closing quote after the period as sentence end', () => {
    const mots = construireMots([
      ['Il', 0, 0.2],
      ['dit.»', 0.3, 0.6],
      ['Puis', 0.8, 1.0],
    ])
    expect(decouperPhrases(mots)).toHaveLength(2)
  })
})
