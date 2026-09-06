import { describe, expect, it } from 'vitest'
import {
  prochainOrdreRecompense,
  saisieRecompenseVierge,
  validerRecompense,
  type Recompense,
} from './recompenses'

describe('validerRecompense', () => {
  it('accepts a reward with a cost and a cap', () => {
    const resultat = validerRecompense({
      ...saisieRecompenseVierge(3),
      cle: 'place_atelier',
      type: 'atelier',
      titre: 'Une place',
      cout_points: '1200',
      plafond_par_mois: '10',
    })
    expect(resultat).toMatchObject({
      ok: true,
      valeur: {
        cle: 'place_atelier',
        ordre: 3,
        cout_points: 1200,
        plafond_par_mois: 10,
        echangeable: true,
        sous_titre: null,
      },
    })
  })

  it('requires a cost when the reward is exchangeable', () => {
    const resultat = validerRecompense({ ...saisieRecompenseVierge(1), cle: 'x', titre: 'X' })
    expect(resultat.ok).toBe(false)
    if (!resultat.ok) expect(resultat.erreurs).toMatchObject({ cout_points: 'requis' })
  })

  it('makes a distinction free and not exchangeable, whatever the switches say', () => {
    const resultat = validerRecompense({
      ...saisieRecompenseVierge(4),
      cle: 'heure',
      type: 'distinction',
      titre: 'Une heure',
      echangeable: true,
      cout_points: '',
    })
    expect(resultat).toMatchObject({ ok: true, valeur: { echangeable: false, cout_points: null } })
  })

  it('refuses a bad key, a zero cost and a fractional cap', () => {
    const resultat = validerRecompense({
      ...saisieRecompenseVierge(1),
      cle: 'Ma Clé',
      titre: 'X',
      cout_points: '0',
      plafond_par_mois: '2,5',
    })
    expect(resultat.ok).toBe(false)
    if (!resultat.ok)
      expect(resultat.erreurs).toMatchObject({
        cle: 'cle',
        cout_points: 'positif',
        plafond_par_mois: 'entier',
      })
  })

  it('gives the next order in the shop', () => {
    expect(prochainOrdreRecompense([])).toBe(1)
    expect(prochainOrdreRecompense([{ ordre: 4 } as Recompense, { ordre: 2 } as Recompense])).toBe(
      5,
    )
  })
})
