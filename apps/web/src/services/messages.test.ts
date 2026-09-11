import { describe, expect, it } from 'vitest'

import { fr } from '../fr'
import { texteDelai, texteVerdict } from './messages'

const MAINTENANT = new Date('2026-09-11T12:00:00.000Z')

describe('texteDelai', () => {
  it('counts the hours left, with a no-break space before the unit', () => {
    const texte = texteDelai('2026-09-12T12:00:00.000Z', MAINTENANT)
    expect(texte).toContain('24 h')
    expect(texte).not.toContain('24 h')
  })

  it('says the last hour without a number', () => {
    expect(texteDelai('2026-09-11T12:30:00.000Z', MAINTENANT)).toBe(fr.duel.delaiCourt)
  })
})

describe('texteVerdict', () => {
  it('speaks from the invitee side, which is the only side that reads this page', () => {
    expect(texteVerdict({ statut: 'clos', verdict: 'invite' })).toBe(fr.duel.gagne)
    expect(texteVerdict({ statut: 'clos', verdict: 'inviteur' })).toBe(fr.duel.perdu)
    expect(texteVerdict({ statut: 'clos', verdict: 'egalite' })).toBe(fr.duel.egalite)
  })

  it('calls a duel nobody answered an expiry, not a defeat', () => {
    expect(texteVerdict({ statut: 'expire', verdict: null })).toBe(fr.duel.expireTitre)
    expect(texteVerdict({ statut: 'clos', verdict: null })).toBe(fr.duel.expireTitre)
  })
})

describe('the wording rules of decision 17', () => {
  const toutes = collecter(fr)

  it('never uses an em dash', () => {
    expect(toutes.filter((texte) => texte.includes('—'))).toEqual([])
  })

  it('says plainly that the verdict is automatic (cahier chapter 11)', () => {
    expect(fr.duel.automatique).toContain("l'analyse")
    expect(fr.duel.verdictDetail).toContain("l'analyse")
  })

  it('tells what becomes of the voice at the moment it is sent (chapter 2)', () => {
    expect(fr.duel.conservation).toContain('supprimée')
  })

  it('never promises a delay in figures for the deletion (chapter 2)', () => {
    expect(fr.duel.conservation).not.toMatch(/\d/)
    expect(fr.legal.voixTexte).not.toMatch(/\d/)
    expect(fr.legal.voixException).not.toMatch(/\d/)
  })
})

/** Every string of the module, functions called with a sample argument. */
function collecter(valeur: unknown): string[] {
  if (typeof valeur === 'string') return [valeur]
  if (typeof valeur === 'function') return [String((valeur as (x: never) => string)(1 as never))]
  if (valeur && typeof valeur === 'object') return Object.values(valeur).flatMap(collecter)
  return []
}
