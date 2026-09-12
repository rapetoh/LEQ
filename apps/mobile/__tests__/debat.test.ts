import { ErreurDebat, messageRefus, urlDebat } from '@/services/debat'

jest.mock('@/services/supabase', () => ({ supabase: {}, useSession: jest.fn() }))

// What the person reads when the database refuses, and where the socket points.

describe('messageRefus', () => {
  it("says what is actually wrong, in the person's own terms", () => {
    expect(messageRefus(new ErreurDebat('quota_epuise', 'quota_epuise'))).toBe(
      'Tu as utilisé tes sessions du mois. Elles reviennent le mois prochain.',
    )
    expect(messageRefus(new ErreurDebat('these_requise', 'these_requise'))).toBe(
      'Écris la thèse que Rétor va défendre.',
    )
    expect(messageRefus(new ErreurDebat('face_a_face_eteint', 'x'))).toBe(
      "Le face-à-face n'est pas encore ouvert.",
    )
  })

  it('never blames the person for something we could not name', () => {
    const texte = messageRefus(new Error('boom'))
    // The rule, not one wording of it: an unnamed failure never says the person did
    // anything, and never asks them to fix something on their side.
    expect(texte).not.toMatch(/\btu as\b|\bton erreur\b|\bvérifie\b/i)
    expect(texte).toBe("Ça n'a pas marché. Réessaie dans un instant.")
  })

  it('has a sentence for every reason the database can raise', () => {
    const raisons = [
      'compte_requis',
      'compte_suspendu',
      'face_a_face_eteint',
      'quota_epuise',
      'these_introuvable',
      'these_requise',
      'debat_en_cours',
    ] as const
    for (const raison of raisons) {
      const texte = messageRefus(new ErreurDebat(raison, raison))
      expect(texte.length).toBeGreaterThan(0)
      expect(texte).not.toContain(raison)
    }
  })
})

describe('urlDebat', () => {
  it('speaks websocket, whatever scheme the server address uses', () => {
    expect(urlDebat()).toMatch(/^wss?:\/\//)
    expect(urlDebat().endsWith('/debat')).toBe(true)
  })
})
