import { lireCible, routePourCible } from '@/services/notifications'
import { lieuEtDate } from '@/services/rebecca'

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  getLastNotificationResponseAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
}))
jest.mock('expo-device', () => ({ isDevice: false }))
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: null } }))
jest.mock('@/services/supabase', () => ({ supabase: {}, useSession: jest.fn() }))

function reponse(data: unknown) {
  return { notification: { request: { content: { data } } } } as never
}

describe('the notification target', () => {
  it('reads a feedback, an announcement, or nothing', () => {
    expect(lireCible(reponse({ tentative_id: 't1' }))).toEqual({ tentative_id: 't1' })
    expect(lireCible(reponse({ annonce_id: 'a1' }))).toEqual({ annonce_id: 'a1' })
    expect(lireCible(reponse({}))).toBeNull()
    expect(lireCible(null)).toBeNull()
  })

  it('sends an announcement to B1b and nothing else anywhere', () => {
    expect(routePourCible({ annonce_id: 'a1' })).toBe('/aujourdhui/rebecca')
    expect(routePourCible({})).toBeNull()
  })
})

describe('lieuEtDate', () => {
  it('names the place or "En ligne", then the date in French', () => {
    expect(lieuEtDate({ lieu: 'Lyon', en_ligne: false, date_debut: '2026-09-12T17:00:00Z' })).toBe(
      'Lyon · 12 septembre',
    )
    expect(lieuEtDate({ lieu: 'Zoom', en_ligne: true, date_debut: '2026-09-12T17:00:00Z' })).toBe(
      'En ligne · 12 septembre',
    )
  })
})
