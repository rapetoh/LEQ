import { describe, expect, it } from 'vitest'
import {
  analyserConfiguration,
  CLES_CONFIGURATION,
  CONFIGURATION_PAR_DEFAUT,
  DEFINITIONS_CONFIGURATION,
  lireConfiguration,
  validerValeurConfiguration,
} from './configuration.js'
import { lireDrapeaux } from './drapeaux.js'

describe('lireConfiguration', () => {
  it('returns the defaults when there are no rows', () => {
    expect(lireConfiguration([])).toEqual(CONFIGURATION_PAR_DEFAUT)
    expect(CONFIGURATION_PAR_DEFAUT.points_par_defi).toBe(25)
  })

  it('takes the row value over the default', () => {
    const configuration = lireConfiguration([
      { cle: 'points_par_defi', valeur: 30, type: 'nombre' },
    ])
    expect(configuration.points_par_defi).toBe(30)
    expect(configuration.points_par_vote).toBe(5)
  })

  it('reports missing, invalid and unknown rows without throwing', () => {
    const rapport = analyserConfiguration([
      { cle: 'points_par_defi', valeur: 'trente', type: 'nombre' },
      { cle: 'points_par_vote', valeur: 5, type: 'texte' },
      { cle: 'inconnue', valeur: 1 },
      'pas une ligne',
    ])
    expect(rapport.configuration.points_par_defi).toBe(25)
    expect(rapport.invalides.map((p) => p.cle)).toEqual(['points_par_defi', 'points_par_vote', ''])
    expect(rapport.inconnues).toEqual(['inconnue'])
    expect(rapport.manquantes).toHaveLength(CLES_CONFIGURATION.length - 2)
  })

  it('has a definition for every key', () => {
    for (const cle of CLES_CONFIGURATION) {
      expect(DEFINITIONS_CONFIGURATION[cle].description.length).toBeGreaterThan(0)
      expect(validerValeurConfiguration(cle, DEFINITIONS_CONFIGURATION[cle].valeur).success).toBe(
        true,
      )
    }
  })

  it('refuses a negative number', () => {
    expect(validerValeurConfiguration('points_par_defi', -1).success).toBe(false)
  })
})

describe('lireDrapeaux', () => {
  it('is off by default and reads rows', () => {
    expect(lireDrapeaux([])).toEqual({ arene: false, duels: false, face_a_face: false })
    expect(
      lireDrapeaux([
        { cle: 'arene', actif: true },
        { cle: 'x', actif: true },
      ]),
    ).toEqual({
      arene: true,
      duels: false,
      face_a_face: false,
    })
  })
})
