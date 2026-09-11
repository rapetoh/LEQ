import { jourDuSujet } from '@/services/arene'

jest.mock('@/services/supabase', () => ({ supabase: {}, useSession: jest.fn() }))

describe('jourDuSujet', () => {
  const maintenant = new Date('2026-09-11T12:00:00Z')

  it('counts from the activation, one-based, and never leaves the week', () => {
    expect(jourDuSujet({ actif_le: '2026-09-11T09:00:00Z' }, 7, maintenant)).toBe(1)
    expect(jourDuSujet({ actif_le: '2026-09-09T09:00:00Z' }, 7, maintenant)).toBe(3)
    expect(jourDuSujet({ actif_le: '2026-08-01T09:00:00Z' }, 7, maintenant)).toBe(7)
  })

  it('answers the first day when the subject is not activated or the date is broken', () => {
    expect(jourDuSujet({ actif_le: null }, 7, maintenant)).toBe(1)
    expect(jourDuSujet({ actif_le: 'pas une date' }, 7, maintenant)).toBe(1)
  })
})
