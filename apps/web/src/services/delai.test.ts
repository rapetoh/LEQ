import { describe, expect, it } from 'vitest'

import { resteAvant } from './delai'

const MAINTENANT = new Date('2026-09-11T12:00:00.000Z')

describe('resteAvant', () => {
  it('counts whole hours while there is a day left', () => {
    expect(resteAvant('2026-09-13T12:00:00.000Z', MAINTENANT)).toEqual({
      etat: 'heures',
      heures: 48,
    })
    expect(resteAvant('2026-09-11T13:30:00.000Z', MAINTENANT)).toEqual({
      etat: 'heures',
      heures: 1,
    })
  })

  it('says the last hour differently, because a number would read as plenty', () => {
    expect(resteAvant('2026-09-11T12:40:00.000Z', MAINTENANT)).toEqual({ etat: 'court' })
  })

  it('treats the deadline itself as passed', () => {
    expect(resteAvant('2026-09-11T12:00:00.000Z', MAINTENANT)).toEqual({ etat: 'passe' })
    expect(resteAvant('2026-09-10T12:00:00.000Z', MAINTENANT)).toEqual({ etat: 'passe' })
  })

  it('does not crash on a date the server never sent', () => {
    expect(resteAvant('pas une date', MAINTENANT)).toEqual({ etat: 'passe' })
  })
})
