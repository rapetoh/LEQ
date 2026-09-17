import { pino } from 'pino'
import { describe, expect, it } from 'vitest'
import type { Executeur, Job } from '../db.js'
import { creerHandlerNotifierModeration } from './moderation.js'

const log = pino({ level: 'silent' })

/** A database with one take owned by `u1`, `u1` holding one token, and two admin tokens. */
function fausseBase(proprietaire: string | null) {
  const ex: Executeur = {
    async query(text: string, values?: unknown[]) {
      const ligne = (rows: unknown[]) =>
        ({ rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] }) as never
      if (text.includes('from public.prises_publiques where id')) {
        return ligne(proprietaire === null ? [] : [{ utilisateur_id: proprietaire }])
      }
      if (text.includes('from public.jetons_push j') && text.includes('raw_app_meta_data')) {
        return ligne([
          { id: 'a1', jeton: 'ExponentPushToken[admin-1]' },
          { id: 'a2', jeton: 'ExponentPushToken[admin-2]' },
        ])
      }
      if (text.includes('from public.jetons_push') && values?.[0] === 'u1') {
        return ligne([{ id: 'j1', jeton: 'ExponentPushToken[u1]' }])
      }
      if (text.includes('update public.jetons_push')) return ligne([])
      throw new Error(`requête inattendue: ${text}`)
    },
  }
  return ex
}

function job(evenement: string): Job {
  return {
    id: 1,
    type: 'notifier_moderation',
    charge: { prise_id: '3f7b7d2e-4c8a-4d7e-9a3f-1e2d3c4b5a69', evenement },
    essais: 0,
  } as unknown as Job
}

describe('notifier_moderation', () => {
  it('prévient la personne et les admins quand une prise est signalée', async () => {
    const envoyes: Array<{ to: string; title: string }> = []
    const handler = creerHandlerNotifierModeration({
      ex: fausseBase('u1'),
      envoyer: async (messages) => {
        envoyes.push(...messages.map((m) => ({ to: m.to, title: m.title })))
        return messages.map(() => ({ status: 'ok' as const, id: 'x' }))
      },
    })
    await handler(job('signalee'), { log, dernierEssai: false })
    expect(envoyes).toEqual([
      { to: 'ExponentPushToken[u1]', title: 'Ton passage attend une relecture' },
      { to: 'ExponentPushToken[admin-1]', title: 'Une prise est signalée' },
      { to: 'ExponentPushToken[admin-2]', title: 'Une prise est signalée' },
    ])
  })

  it('ne prévient que la personne quand Rebecca a décidé', async () => {
    const envoyes: Array<{ to: string; title: string }> = []
    const handler = creerHandlerNotifierModeration({
      ex: fausseBase('u1'),
      envoyer: async (messages) => {
        envoyes.push(...messages.map((m) => ({ to: m.to, title: m.title })))
        return messages.map(() => ({ status: 'ok' as const, id: 'x' }))
      },
    })
    await handler(job('retiree'), { log, dernierEssai: false })
    expect(envoyes).toEqual([{ to: 'ExponentPushToken[u1]', title: 'Ton passage a été retiré' }])
  })

  it('ne dit rien quand la prise a disparu', async () => {
    let appels = 0
    const handler = creerHandlerNotifierModeration({
      ex: fausseBase(null),
      envoyer: async (messages) => {
        appels += 1
        return messages.map(() => ({ status: 'ok' as const, id: 'x' }))
      },
    })
    await handler(job('publiee'), { log, dernierEssai: false })
    expect(appels).toBe(0)
  })

  it('refuse une charge qui ne dit pas quel événement', async () => {
    const handler = creerHandlerNotifierModeration({
      ex: fausseBase('u1'),
      envoyer: async () => [],
    })
    await expect(
      handler({ ...job('signalee'), charge: { prise_id: 'x' } }, { log, dernierEssai: false }),
    ).rejects.toThrow('Invalid charge')
  })
})
