import { describe, expect, it } from 'vitest'
import type { SujetArene } from '@leq/domaine'
import { etatSujet, prochainOrdreSujet, saisieSujetVierge, validerSujet } from './sujets'

function sujet(surcharges: Partial<SujetArene>): SujetArene {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    cle: 'sujet_un',
    texte: 'Faut-il encore apprendre par cœur ?',
    consigne: null,
    ordre: 1,
    duree_max_s: 90,
    actif_le: null,
    ferme_le: null,
    provisoire: true,
    actif: true,
    cree_le: 'x',
    modifie_le: 'x',
    ...surcharges,
  }
}

describe('validerSujet', () => {
  it('accepts a complete subject and trims its texts', () => {
    const resultat = validerSujet({
      ...saisieSujetVierge(2),
      cle: 'par_coeur',
      texte: '  Faut-il apprendre par cœur ?  ',
      consigne: ' Une minute ',
    })
    expect(resultat).toMatchObject({
      ok: true,
      valeur: {
        cle: 'par_coeur',
        texte: 'Faut-il apprendre par cœur ?',
        consigne: 'Une minute',
        ordre: 2,
      },
    })
  })

  it('names every field in error', () => {
    const resultat = validerSujet({ ...saisieSujetVierge(1), cle: 'Ma Clé', duree_max_s: '0' })
    expect(resultat.ok).toBe(false)
    if (!resultat.ok) {
      expect(resultat.erreurs).toMatchObject({
        cle: 'cle',
        texte: 'requis',
        duree_max_s: 'positif',
      })
    }
  })

  it('gives the next order in the bank', () => {
    expect(prochainOrdreSujet([])).toBe(1)
    expect(prochainOrdreSujet([sujet({ ordre: 3 }), sujet({ ordre: 1 })])).toBe(4)
  })
})

describe('etatSujet', () => {
  const maintenant = new Date('2026-09-11T12:00:00Z')

  it('reads the rotation from the dates', () => {
    expect(etatSujet(sujet({}), maintenant)).toBe('a_venir')
    expect(etatSujet(sujet({ actif_le: '2026-09-09T12:00:00Z' }), maintenant)).toBe('en_cours')
    expect(
      etatSujet(
        sujet({ actif_le: '2026-09-01T12:00:00Z', ferme_le: '2026-09-08T12:00:00Z' }),
        maintenant,
      ),
    ).toBe('passe')
    expect(etatSujet(sujet({ actif: false }), maintenant)).toBe('inactif')
  })
})
