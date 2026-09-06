import { pino } from 'pino'
import { describe, expect, it } from 'vitest'
import type { Executeur } from '../db.js'
import { notifierRetourPret, type ReponseExpoTicket } from './expoPush.js'

const log = pino({ level: 'silent' })

function fauxExecuteur(jetons: Array<{ id: string; jeton: string }>) {
  const marques: Array<{ id: string; erreur: string | null; desactiver: boolean }> = []
  const ex: Executeur = {
    async query(text: string, values?: unknown[]) {
      if (text.startsWith('select id, jeton'))
        return {
          rows: jetons,
          rowCount: jetons.length,
          command: 'SELECT',
          oid: 0,
          fields: [],
        } as never
      if (text.includes('update public.jetons_push')) {
        marques.push({
          id: String(values?.[0]),
          erreur: values?.[1] as string | null,
          desactiver: Boolean(values?.[2]),
        })
        return { rows: [], rowCount: 1, command: 'UPDATE', oid: 0, fields: [] } as never
      }
      throw new Error(`requête inattendue: ${text}`)
    },
  }
  return { ex, marques }
}

describe('notifierRetourPret', () => {
  it('sends one message per active token and records success', async () => {
    const { ex, marques } = fauxExecuteur([
      { id: 'j1', jeton: 'ExponentPushToken[a]' },
      { id: 'j2', jeton: 'ExponentPushToken[b]' },
    ])
    let envoyes: unknown[] = []
    const resultat = await notifierRetourPret(
      {
        ex,
        log,
        envoyer: async (m) => {
          envoyes = m
          return m.map(() => ({ status: 'ok', id: 'x' }) as ReponseExpoTicket)
        },
      },
      'u1',
      't1',
    )
    expect(resultat).toEqual({ envoyes: 2, echecs: 0 })
    expect(envoyes).toHaveLength(2)
    expect((envoyes[0] as { title: string }).title).toBe('Ton retour est prêt')
    expect(marques.every((m) => m.erreur === null && !m.desactiver)).toBe(true)
  })

  it('switches off a token Expo reports as unregistered and keeps the others', async () => {
    const { ex, marques } = fauxExecuteur([
      { id: 'j1', jeton: 'ExponentPushToken[a]' },
      { id: 'j2', jeton: 'ExponentPushToken[b]' },
    ])
    const resultat = await notifierRetourPret(
      {
        ex,
        log,
        envoyer: async () => [
          { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } },
          { status: 'ok' },
        ],
      },
      'u1',
      't1',
    )
    expect(resultat).toEqual({ envoyes: 1, echecs: 1 })
    expect(marques.find((m) => m.id === 'j1')).toEqual({
      id: 'j1',
      erreur: 'DeviceNotRegistered',
      desactiver: true,
    })
    expect(marques.find((m) => m.id === 'j2')?.desactiver).toBe(false)
  })

  it('never throws when Expo is unreachable or the user has no token', async () => {
    const sans = fauxExecuteur([])
    expect(
      await notifierRetourPret(
        {
          ex: sans.ex,
          log,
          envoyer: async () => {
            throw new Error('non')
          },
        },
        'u1',
        't1',
      ),
    ).toEqual({ envoyes: 0, echecs: 0 })
    const avec = fauxExecuteur([{ id: 'j1', jeton: 'ExponentPushToken[a]' }])
    expect(
      await notifierRetourPret(
        {
          ex: avec.ex,
          log,
          envoyer: async () => {
            throw new Error('non')
          },
        },
        'u1',
        't1',
      ),
    ).toEqual({ envoyes: 0, echecs: 1 })
  })
})
