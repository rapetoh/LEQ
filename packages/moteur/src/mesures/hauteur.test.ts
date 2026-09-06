import { describe, expect, it } from 'vitest'
import { construireProsodie } from '../fixtures/synthese.js'
import { mesurerHauteur } from './hauteur.js'

describe('hauteur', () => {
  it('gives zero spread on a flat pitch', () => {
    const prosodie = construireProsodie(2, [{ debut_s: 0, fin_s: 2, f0_hz: 120 }])
    const mesure = mesurerHauteur(prosodie)
    expect(mesure).toEqual({
      f0_median_hz: 120,
      f0_ecart_type_demi_tons: 0,
      plage_demi_tons: 0,
      ratio_voise: 1,
    })
  })

  it('measures spread in semitones around the median and the voiced ratio', () => {
    // half the voiced frames one octave up: median falls between, spread is 12 semitones
    const prosodie = construireProsodie(4, [
      { debut_s: 0, fin_s: 1, f0_hz: 100 },
      { debut_s: 2, fin_s: 3, f0_hz: 200 },
    ])
    const mesure = mesurerHauteur(prosodie)
    expect(mesure.f0_median_hz).toBe(150)
    expect(mesure.plage_demi_tons).toBeCloseTo(12, 1)
    expect(mesure.f0_ecart_type_demi_tons).toBeCloseTo(6, 1)
    expect(mesure.ratio_voise).toBe(0.5)
  })

  it('restricts the voiced ratio to the spoken span when given', () => {
    const prosodie = construireProsodie(10, [{ debut_s: 4, fin_s: 6, f0_hz: 110 }])
    expect(mesurerHauteur(prosodie).ratio_voise).toBe(0.2)
    expect(mesurerHauteur(prosodie, { debut_s: 4, fin_s: 8 }).ratio_voise).toBe(0.5)
  })

  it('ignores out-of-range values and returns nulls on silence', () => {
    const prosodie = construireProsodie(1, [{ debut_s: 0, fin_s: 1, f0_hz: 900 }])
    expect(mesurerHauteur(prosodie).f0_median_hz).toBeNull()
    const muet = construireProsodie(1, [])
    expect(mesurerHauteur(muet)).toEqual({
      f0_median_hz: null,
      f0_ecart_type_demi_tons: null,
      plage_demi_tons: null,
      ratio_voise: null,
    })
  })
})
