import type { LigneClassement } from '@leq/domaine'

import { HAUTEURS, maLigne, marches, reste } from '@/services/podiumVue'

function ligne(rang: number, options: Partial<LigneClassement> = {}): LigneClassement {
  return {
    rang,
    prise_id: `p${rang}`,
    votes: Math.max(0, 10 - rang),
    moi: false,
    nom: `Voix ${rang}`,
    ...options,
  }
}

describe('marches', () => {
  it('draws the podium the way it stands: second, first, third', () => {
    const [gauche, milieu, droite] = marches([ligne(1), ligne(2), ligne(3), ligne(4)])
    expect([gauche.rang, milieu.rang, droite.rang]).toEqual([2, 1, 3])
    expect(milieu.ligne?.prise_id).toBe('p1')
  })

  it('leaves a step empty rather than moving someone up a place', () => {
    const [gauche, milieu, droite] = marches([ligne(1)])
    expect(milieu.ligne?.prise_id).toBe('p1')
    expect(gauche.ligne).toBeNull()
    expect(droite.ligne).toBeNull()
  })

  it('holds on a week nobody spoke in', () => {
    expect(marches([]).every((marche) => marche.ligne === null)).toBe(true)
  })

  it('gives the first step the full height', () => {
    expect(HAUTEURS[1]).toBe(1)
    expect(HAUTEURS[2]).toBeGreaterThan(HAUTEURS[3])
  })
})

describe('reste', () => {
  it('lists everyone below the podium, in order', () => {
    expect(reste([ligne(1), ligne(2), ligne(3), ligne(4), ligne(5)]).map((l) => l.rang)).toEqual([
      4, 5,
    ])
  })

  it('is empty when the week fits on the podium', () => {
    expect(reste([ligne(1), ligne(2)])).toEqual([])
  })
})

describe('maLigne', () => {
  it('finds the caller wherever they landed', () => {
    expect(maLigne([ligne(1), ligne(2, { moi: true })])?.rang).toBe(2)
  })

  it('answers nothing when the person did not speak that week', () => {
    expect(maLigne([ligne(1), ligne(2)])).toBeNull()
  })
})
