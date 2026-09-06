import { estDejaPresent, estDoublon } from '@/services/tentatives'

jest.mock('expo-file-system', () => ({ File: class {} }))
jest.mock('@/services/supabase', () => ({ supabase: {} }))

describe('idempotent upload', () => {
  it('treats an existing object or row as done', () => {
    expect(estDejaPresent({ statusCode: '409', message: 'The resource already exists' })).toBe(true)
    expect(estDejaPresent({ message: 'Duplicate' })).toBe(true)
    expect(
      estDejaPresent({ statusCode: '403', message: 'new row violates row-level security policy' }),
    ).toBe(false)
    expect(estDoublon({ code: '23505' })).toBe(true)
    expect(estDoublon({ code: '42501' })).toBe(false)
  })
})
