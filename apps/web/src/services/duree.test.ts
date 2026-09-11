import { describe, expect, it } from 'vitest'

import { formaterDuree, partAnneau } from './duree'

describe('formaterDuree', () => {
  it('reads seconds as a timer does', () => {
    expect(formaterDuree(0)).toBe('0:00')
    expect(formaterDuree(9.9)).toBe('0:09')
    expect(formaterDuree(65)).toBe('1:05')
    expect(formaterDuree(600)).toBe('10:00')
  })

  it('never shows a negative time', () => {
    expect(formaterDuree(-3)).toBe('0:00')
  })
})

describe('partAnneau', () => {
  it('fills from nothing to a full turn', () => {
    expect(partAnneau(0, 90)).toBe(0)
    expect(partAnneau(45, 90)).toBe(0.5)
    expect(partAnneau(90, 90)).toBe(1)
  })

  it('stops at a full turn when the take runs past the ceiling', () => {
    expect(partAnneau(120, 90)).toBe(1)
  })

  it('answers nothing rather than dividing by zero', () => {
    expect(partAnneau(10, 0)).toBe(0)
    expect(partAnneau(10, Number.NaN)).toBe(0)
  })
})
