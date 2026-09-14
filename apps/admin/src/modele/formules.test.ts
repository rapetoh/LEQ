import { describe, expect, it } from 'vitest'
import {
  cleDepuisNom,
  prochainOrdreFormule,
  saisieFormuleVierge,
  validerFormule,
  type FormuleDetail,
} from './formules'

describe('validerFormule', () => {
  it('accepts a third tier written as a row', () => {
    const resultat = validerFormule({
      ...saisieFormuleVierge(3),
      cle: 'atelier',
      nom: 'Atelier',
      etapes_par_jour: '0',
      debats_par_mois: '20',
      duree_debat_s: '480',
      acces_communaute: true,
      produit_store: 'leq_atelier_mensuel',
    })
    expect(resultat).toMatchObject({
      ok: true,
      valeur: {
        cle: 'atelier',
        ordre: 3,
        etapes_par_jour: 0,
        debats_par_mois: 20,
        duree_debat_s: 480,
        acces_communaute: true,
        produit_store: 'leq_atelier_mensuel',
      },
    })
  })

  it('refuses a debate with no speaking time and a key with capitals', () => {
    const resultat = validerFormule({
      ...saisieFormuleVierge(1),
      cle: 'Premium',
      nom: 'Premium',
      duree_debat_s: '0',
    })
    expect(resultat.ok).toBe(false)
    if (!resultat.ok)
      expect(resultat.erreurs).toMatchObject({ cle: 'cle', duree_debat_s: 'positif' })
  })

  it('leaves the store product empty for a tier nobody buys', () => {
    const resultat = validerFormule({ ...saisieFormuleVierge(1), cle: 'gratuit', nom: 'Gratuit' })
    expect(resultat).toMatchObject({ ok: true, valeur: { produit_store: null } })
  })
})

describe('cleDepuisNom', () => {
  it('writes the key from the name', () => {
    expect(cleDepuisNom('Formule Étudiante  2027')).toBe('formule_etudiante_2027')
  })
})

describe('prochainOrdreFormule', () => {
  it('goes after the last one', () => {
    const formules = [{ ordre: 1 }, { ordre: 4 }] as FormuleDetail[]
    expect(prochainOrdreFormule(formules)).toBe(5)
    expect(prochainOrdreFormule([])).toBe(1)
  })
})
