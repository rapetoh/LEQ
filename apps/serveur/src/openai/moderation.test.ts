import { describe, expect, it } from 'vitest'
import { verdictDepuisCategories } from './moderation.js'

const quand = new Date('2026-09-17T10:00:00Z')

describe('le filtre de chapitre 11', () => {
  it('retient le harcèlement et le dit une fois, quelle que soit la sous-catégorie', () => {
    const verdict = verdictDepuisCategories(
      { harassment: true, 'harassment/threatening': true, sexual: false },
      'test',
      quand,
    )
    expect(verdict).toEqual({
      version: 1,
      signalee: true,
      categories: ['harcelement'],
      fournisseur: 'test',
      evalue_le: '2026-09-17T10:00:00.000Z',
    })
  })

  it('range les catégories dans l ordre du cahier, pas dans celui du fournisseur', () => {
    const verdict = verdictDepuisCategories(
      { 'illicit/violent': true, sexual: true, hate: true },
      'test',
      quand,
    )
    expect(verdict.categories).toEqual(['sexuel', 'haine', 'illicite'])
  })

  it('laisse passer ce que le cahier ne nomme pas', () => {
    // A category the provider might add tomorrow, or a subject like politics that has none.
    const verdict = verdictDepuisCategories({ politics: true, religion: true }, 'test', quand)
    expect(verdict.signalee).toBe(false)
    expect(verdict.categories).toEqual([])
  })

  it('ne signale rien quand rien n est vrai', () => {
    const verdict = verdictDepuisCategories({ harassment: false, violence: false }, 'test', quand)
    expect(verdict.signalee).toBe(false)
  })
})
