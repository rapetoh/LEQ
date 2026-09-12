import { describe, expect, it } from 'vitest'
import type { These } from '@leq/domaine'

import { prochainOrdreThese, proposeesMaintenant, saisieTheseVierge, validerThese } from './theses'

function these(surcharges: Partial<These>): These {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    cle: 'these_un',
    texte: 'Le télétravail a tué la vie de bureau.',
    ton_suggere: 'ferme',
    ordre: 1,
    actif: true,
    provisoire: true,
    cree_le: 'x',
    modifie_le: 'x',
    ...surcharges,
  }
}

describe('validerThese', () => {
  it('accepts a complete thesis and trims its texts', () => {
    const resultat = validerThese({
      ...saisieTheseVierge(4),
      cle: ' these_quatre ',
      texte: '  On devrait tirer les responsables au sort.  ',
    })
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.valeur.cle).toBe('these_quatre')
    expect(resultat.valeur.texte).toBe('On devrait tirer les responsables au sort.')
    expect(resultat.valeur.ordre).toBe(4)
  })

  it('refuses a thesis with no text: Rétor would have nothing to defend', () => {
    const resultat = validerThese({ ...saisieTheseVierge(1), cle: 'x', texte: '   ' })
    expect(resultat.ok).toBe(false)
    if (resultat.ok) return
    expect(resultat.erreurs.texte).toBe('requis')
  })

  it('refuses a key that is not a key', () => {
    const resultat = validerThese({ ...saisieTheseVierge(1), cle: 'Thèse Un', texte: 'a' })
    expect(resultat.ok).toBe(false)
    if (resultat.ok) return
    expect(resultat.erreurs.cle).toBe('cle')
  })

  it('refuses a tone the database would reject anyway', () => {
    const resultat = validerThese({
      ...saisieTheseVierge(1),
      cle: 'x',
      texte: 'a',
      ton_suggere: 'moqueur',
    })
    expect(resultat.ok).toBe(false)
    if (resultat.ok) return
    expect(resultat.erreurs.ton_suggere).toBe('contrat')
  })

  it('refuses an order that is not a whole number above zero', () => {
    for (const ordre of ['0', '-2', '1.5', 'deux', '']) {
      const resultat = validerThese({ ...saisieTheseVierge(1), cle: 'x', texte: 'a', ordre })
      expect(resultat.ok).toBe(false)
    }
  })
})

describe('prochainOrdreThese', () => {
  it('follows the highest order in the bank, not the count', () => {
    expect(prochainOrdreThese([these({ ordre: 2 }), these({ ordre: 7 })])).toBe(8)
  })

  it('starts at one on an empty bank', () => {
    expect(prochainOrdreThese([])).toBe(1)
  })
})

describe('proposeesMaintenant', () => {
  it('shows what the app would actually offer, in order', () => {
    const banque = [these({ ordre: 3 }), these({ ordre: 1 }), these({ ordre: 2 })]
    expect(proposeesMaintenant(banque).map((t) => t.ordre)).toEqual([1, 2, 3])
  })

  it('leaves out what is switched off', () => {
    const banque = [these({ ordre: 1, actif: false }), these({ ordre: 2 })]
    expect(proposeesMaintenant(banque).map((t) => t.ordre)).toEqual([2])
  })

  it('stops at the number the app asks for', () => {
    const banque = [1, 2, 3, 4, 5].map((ordre) => these({ ordre }))
    expect(proposeesMaintenant(banque, 3)).toHaveLength(3)
  })
})
