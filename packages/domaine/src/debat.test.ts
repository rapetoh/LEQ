import { describe, expect, it } from 'vitest'

import { consommeUneSession, lireRefusDebat, ISSUES_DEBAT } from './debat.js'

describe('consommeUneSession', () => {
  it('does not charge the person for a session we cut ourselves (chapter 10)', () => {
    expect(consommeUneSession('interrompue_par_nous')).toBe(false)
  })

  it('charges a session that went to the end, and one the person walked away from', () => {
    expect(consommeUneSession('terminee')).toBe(true)
    expect(consommeUneSession('abandonnee')).toBe(true)
  })

  it('charges nothing while the session is still running', () => {
    expect(consommeUneSession(null)).toBe(false)
  })

  it('has an answer for every outcome the database can write', () => {
    for (const issue of ISSUES_DEBAT) expect(typeof consommeUneSession(issue)).toBe('boolean')
  })
})

describe('lireRefusDebat', () => {
  it('reads the reason out of a database error message', () => {
    expect(lireRefusDebat('erreur: quota_epuise')).toBe('quota_epuise')
    expect(lireRefusDebat('face_a_face_eteint')).toBe('face_a_face_eteint')
  })

  it('answers nothing for a message that carries no known reason', () => {
    expect(lireRefusDebat('connexion perdue')).toBeNull()
  })
})
