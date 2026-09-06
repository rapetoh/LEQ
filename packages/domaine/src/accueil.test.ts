import { describe, expect, it } from 'vitest'
import { LIBELLES_BLOCAGE, NouvellesReponsesAccueilSchema, QUESTIONS_ACCUEIL } from './accueil.js'
import { JetonExpoSchema, MESSAGE_RETOUR_PRET, NouveauJetonPushSchema } from './notifications.js'

describe('accueil', () => {
  it('asks three questions in the mockup order with four options each', () => {
    expect(QUESTIONS_ACCUEIL.map((q) => q.cle)).toEqual(['contexte', 'blocage', 'objectif'])
    for (const q of QUESTIONS_ACCUEIL) expect(q.options).toHaveLength(4)
    expect(LIBELLES_BLOCAGE.trac).toBe('Le trac juste avant de commencer')
  })

  it('accepts the codes and refuses a label', () => {
    const base = {
      utilisateur_id: '0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f',
      contexte: 'travail',
      blocage: 'trac',
      objectif: 'stress',
    }
    expect(NouvellesReponsesAccueilSchema.safeParse(base).success).toBe(true)
    expect(NouvellesReponsesAccueilSchema.safeParse({ ...base, blocage: 'Le trac' }).success).toBe(
      false,
    )
  })

  it('has no em dash in any label or message', () => {
    const textes = [
      ...QUESTIONS_ACCUEIL.flatMap((q) => [q.question, ...Object.values(q.libelles)]),
      MESSAGE_RETOUR_PRET.titre,
      MESSAGE_RETOUR_PRET.corps,
    ]
    for (const t of textes) expect(t.includes('—')).toBe(false)
  })
})

describe('jetons push', () => {
  it('accepts Expo tokens only', () => {
    expect(JetonExpoSchema.safeParse('ExponentPushToken[abc123-XYZ]').success).toBe(true)
    expect(JetonExpoSchema.safeParse('ExpoPushToken[abc]').success).toBe(true)
    expect(JetonExpoSchema.safeParse('fcm:abc').success).toBe(false)
    const row = NouveauJetonPushSchema.parse({
      utilisateur_id: '0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f',
      jeton: 'ExponentPushToken[abc]',
      plateforme: 'ios',
    })
    expect(row.desactive_le).toBeNull()
  })
})
