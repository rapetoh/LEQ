import { describe, expect, it } from 'vitest'
import { estCheminMesureV1, MesuresSchema } from './mesures.js'

/** The example of docs/DATA-MODEL.md, verbatim. */
const exemple = {
  version: 1,
  duree_totale_s: 82.4,
  duree_parole_s: 71.9,
  temps_avant_demarrage_s: 1.8,
  debit: {
    mots_par_minute: 142,
    stabilite: 0.12,
    fenetres: [{ debut_s: 0, fin_s: 10, mots_par_minute: 138 }],
  },
  mots_bequilles: {
    total: 4,
    par_minute: 3.3,
    par_type: { 'du coup': 3, euh: 1 },
    occurrences: [{ mot: 'du coup', debut_s: 12.4 }],
  },
  silences: {
    total: 6,
    tenus: 2,
    duree_moyenne_s: 0.9,
    duree_max_s: 1.6,
    positions: [{ debut_s: 20.1, duree_s: 1.2, place: 'fin_de_phrase' }],
  },
  souffle: {
    segments_sans_pause: [{ debut_s: 0, fin_s: 14.2, mots: 31 }],
    longueur_max_s: 14.2,
  },
  volume: { moyen_db: -22.1, ecart_type_db: 4.3, chutes_fin_phrase: 3, ratio_chutes: 0.4 },
  hauteur: {
    f0_median_hz: 118,
    f0_ecart_type_demi_tons: 2.1,
    plage_demi_tons: 9.5,
    ratio_voise: 0.71,
  },
  repetitions: { total: 2, reprises: 1, occurrences: [{ texte: 'je je', debut_s: 33.0 }] },
  phrases: { nombre: 11, longueur_moyenne_mots: 15.2, longueur_max_mots: 31 },
}

describe('MesuresSchema', () => {
  it('accepts the contract example', () => {
    const resultat = MesuresSchema.safeParse(exemple)
    expect(resultat.success).toBe(true)
  })

  it('accepts null leaves on a silent take', () => {
    const silencieux = {
      ...exemple,
      temps_avant_demarrage_s: null,
      debit: { mots_par_minute: null, stabilite: null, fenetres: [] },
      hauteur: {
        f0_median_hz: null,
        f0_ecart_type_demi_tons: null,
        plage_demi_tons: null,
        ratio_voise: null,
      },
    }
    expect(MesuresSchema.safeParse(silencieux).success).toBe(true)
  })

  it('rejects an unknown version or a negative count', () => {
    expect(MesuresSchema.safeParse({ ...exemple, version: 2 }).success).toBe(false)
    expect(
      MesuresSchema.safeParse({ ...exemple, silences: { ...exemple.silences, total: -1 } }).success,
    ).toBe(false)
  })
})

describe('estCheminMesureV1', () => {
  it('knows the enumerated leaves and the filler-word paths', () => {
    expect(estCheminMesureV1('debit.mots_par_minute')).toBe(true)
    expect(estCheminMesureV1('mots_bequilles.par_type.du coup')).toBe(true)
    expect(estCheminMesureV1('mots_bequilles.par_type.')).toBe(false)
    expect(estCheminMesureV1('debit.fenetres')).toBe(false)
  })
})
