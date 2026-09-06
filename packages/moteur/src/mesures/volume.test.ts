import { describe, expect, it } from 'vitest'
import { construireMots, construirePcm, silence, sinus } from '../fixtures/synthese.js'
import { mesurerVolume, niveauxParTrame } from './volume.js'

describe('volume', () => {
  it('converts RMS per 50 ms frame to dBFS', () => {
    const niveaux = niveauxParTrame(sinus(1, 0.5))
    expect(niveaux).toHaveLength(20)
    // RMS of a 0.5 amplitude sine is 0.3536, about -9.03 dBFS
    for (const n of niveaux) expect(n).toBeCloseTo(-9.03, 1)
    expect(niveauxParTrame(silence(0.5))).toEqual(new Array<number>(10).fill(-100))
  })

  it('measures mean and deviation over spoken frames only', () => {
    const pcm = construirePcm([
      { type: 'silence', duree_s: 1 },
      { type: 'ton', duree_s: 1, amplitude: 0.5 },
      { type: 'silence', duree_s: 1 },
      { type: 'ton', duree_s: 1, amplitude: 0.25 },
      { type: 'silence', duree_s: 1 },
    ])
    const mots = construireMots([
      ['fort', 1, 2],
      ['doux', 3, 4],
    ])
    const mesure = mesurerVolume(pcm, mots)
    // halfway between -9.03 and -15.05 dB
    expect(mesure.moyen_db).toBeCloseTo(-12.04, 1)
    expect(mesure.ecart_type_db).toBeCloseTo(3.01, 1)
  })

  it('counts a sentence ending 6 dB or more below its mean', () => {
    // sentence 1: steady level; sentence 2: last 400 ms at -12 dB
    const pcm = construirePcm([
      { type: 'ton', duree_s: 2, amplitude: 0.5 },
      { type: 'silence', duree_s: 0.5 },
      { type: 'ton', duree_s: 1.6, amplitude: 0.5 },
      { type: 'ton', duree_s: 0.4, amplitude: 0.125 },
      { type: 'silence', duree_s: 0.5 },
    ])
    const mots = construireMots([
      ['Première', 0, 1],
      ['phrase.', 1, 2],
      ['Deuxième', 2.5, 3.5],
      ['phrase.', 3.5, 4.5],
    ])
    const mesure = mesurerVolume(pcm, mots)
    expect(mesure.chutes_fin_phrase).toBe(1)
    expect(mesure.ratio_chutes).toBe(0.5)
  })

  it('skips sentence gaps when judging the last 400 ms', () => {
    // words separated by 100 ms of digital silence must not create a fake drop
    const pcm = construirePcm([
      { type: 'ton', duree_s: 0.5, amplitude: 0.5 },
      { type: 'silence', duree_s: 0.1 },
      { type: 'ton', duree_s: 0.5, amplitude: 0.5 },
      { type: 'silence', duree_s: 0.1 },
      { type: 'ton', duree_s: 0.3, amplitude: 0.5 },
    ])
    const mots = construireMots([
      ['un', 0, 0.5],
      ['deux', 0.6, 1.1],
      ['trois.', 1.2, 1.5],
    ])
    expect(mesurerVolume(pcm, mots).chutes_fin_phrase).toBe(0)
  })

  it('returns nulls on a silent take and falls back without a transcript', () => {
    const muet = mesurerVolume(silence(2), [])
    expect(muet).toEqual({
      moyen_db: null,
      ecart_type_db: null,
      chutes_fin_phrase: 0,
      ratio_chutes: null,
    })
    const sansTexte = mesurerVolume(sinus(1, 0.5), [])
    expect(sansTexte.moyen_db).toBeCloseTo(-9.03, 1)
    expect(sansTexte.ratio_chutes).toBeNull()
  })
})
