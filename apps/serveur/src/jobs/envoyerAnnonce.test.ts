import { pino } from 'pino'
import { describe, expect, it } from 'vitest'
import type { Executeur } from '../db.js'
import type { ReponseExpoTicket } from '../notifications/expoPush.js'
import { envoyerAnnonce, TAILLE_LOT_PUSH } from './envoyerAnnonce.js'

const log = pino({ level: 'silent' })
const ANNONCE = '9a9a9a9a-9a9a-4a9a-8a9a-9a9a9a9a9a9a'

function fauxExecuteur(options: {
  annonce: { regions: string[] | null; destinataires: number | null } | null
  jetons: Array<{ id: string; jeton: string }>
  dejaReservee?: boolean
}) {
  const marques: Array<{ id: string; erreur: string | null; desactiver: boolean }> = []
  const resultats: unknown[][] = []
  let regionsDemandees: unknown = 'non demandé'
  const ex: Executeur = {
    async query(text: string, values?: unknown[]) {
      const reponse = (rows: unknown[]) =>
        ({ rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] }) as never
      if (text.includes('from public.annonces')) {
        return reponse(
          options.annonce
            ? [
                {
                  id: ANNONCE,
                  titre: 'Rebecca ouvre un atelier',
                  corps: 'Le 12 septembre.',
                  regions: options.annonce.regions,
                  destinataires: options.annonce.destinataires,
                  envoyes: 3,
                  echecs: 0,
                },
              ]
            : [],
        )
      }
      if (text.includes('from public.jetons_push')) {
        regionsDemandees = values?.[0]
        return reponse(options.jetons)
      }
      if (text.includes('update public.jetons_push')) {
        marques.push({
          id: String(values?.[0]),
          erreur: values?.[1] as string | null,
          desactiver: Boolean(values?.[2]),
        })
        return reponse([])
      }
      if (text.includes('set destinataires = $2 where id = $1 and destinataires is null')) {
        resultats.push(['reservation', ...(values ?? [])])
        return reponse(options.dejaReservee ? [] : [{ id: ANNONCE }])
      }
      if (text.includes('update public.annonces')) {
        resultats.push(values ?? [])
        return reponse([])
      }
      throw new Error(`requête inattendue: ${text}`)
    },
  }
  return { ex, marques, resultats, regions: () => regionsDemandees }
}

describe('envoyerAnnonce', () => {
  it('sends one push per token, marks tokens and writes the counts back', async () => {
    const faux = fauxExecuteur({
      annonce: { regions: ['ile_de_france'], destinataires: null },
      jetons: [
        { id: 'j1', jeton: 'ExponentPushToken[a]' },
        { id: 'j2', jeton: 'ExponentPushToken[b]' },
      ],
    })
    const envoyes: Array<{ to: string; title: string; body: string; data: unknown }> = []
    const bilan = await envoyerAnnonce(
      {
        ex: faux.ex,
        envoyer: async (messages) => {
          envoyes.push(...messages)
          return [
            { status: 'ok', id: 't1' },
            { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } },
          ] satisfies ReponseExpoTicket[]
        },
      },
      ANNONCE,
      log,
    )
    expect(bilan).toEqual({ destinataires: 2, envoyes: 1, echecs: 1 })
    expect(envoyes.map((m) => m.to)).toEqual(['ExponentPushToken[a]', 'ExponentPushToken[b]'])
    expect(envoyes[0]).toMatchObject({
      title: 'Rebecca ouvre un atelier',
      body: 'Le 12 septembre.',
      data: { annonce_id: ANNONCE },
    })
    expect(faux.regions()).toEqual(['ile_de_france'])
    expect(faux.marques).toEqual([
      { id: 'j1', erreur: null, desactiver: false },
      { id: 'j2', erreur: 'DeviceNotRegistered', desactiver: true },
    ])
    expect(faux.resultats).toEqual([
      ['reservation', ANNONCE, 2],
      [ANNONCE, 2, 1, 1],
    ])
  })

  it('does not send an announcement that already has its counts', async () => {
    const faux = fauxExecuteur({
      annonce: { regions: null, destinataires: 40 },
      jetons: [{ id: 'j1', jeton: 'x' }],
    })
    let appels = 0
    const bilan = await envoyerAnnonce(
      {
        ex: faux.ex,
        envoyer: async () => {
          appels += 1
          return []
        },
      },
      ANNONCE,
      log,
    )
    expect(appels).toBe(0)
    expect(bilan).toEqual({ destinataires: 40, envoyes: 3, echecs: 0 })
    expect(faux.resultats).toEqual([])
  })

  it('counts a whole batch as failed when Expo is unreachable, and keeps going', async () => {
    const jetons = Array.from({ length: TAILLE_LOT_PUSH + 5 }, (_v, i) => ({
      id: `j${i}`,
      jeton: `ExponentPushToken[${i}]`,
    }))
    const faux = fauxExecuteur({ annonce: { regions: null, destinataires: null }, jetons })
    let lot = 0
    const bilan = await envoyerAnnonce(
      {
        ex: faux.ex,
        envoyer: async (messages) => {
          lot += 1
          if (lot === 1) throw new Error('HTTP 503')
          return messages.map(() => ({ status: 'ok' as const }))
        },
      },
      ANNONCE,
      log,
    )
    expect(bilan).toEqual({
      destinataires: TAILLE_LOT_PUSH + 5,
      envoyes: 5,
      echecs: TAILLE_LOT_PUSH,
    })
    expect(faux.regions()).toBeNull()
  })

  it('sends nothing when another run already claimed the announcement', async () => {
    const faux = fauxExecuteur({
      annonce: { regions: null, destinataires: null },
      jetons: [{ id: 'j1', jeton: 'x' }],
      dejaReservee: true,
    })
    let appels = 0
    const bilan = await envoyerAnnonce(
      {
        ex: faux.ex,
        envoyer: async () => {
          appels += 1
          return []
        },
      },
      ANNONCE,
      log,
    )
    expect(appels).toBe(0)
    expect(bilan).toEqual({ destinataires: 1, envoyes: 0, echecs: 0 })
  })

  it('does nothing for an unknown announcement', async () => {
    const faux = fauxExecuteur({ annonce: null, jetons: [] })
    const bilan = await envoyerAnnonce({ ex: faux.ex, envoyer: async () => [] }, ANNONCE, log)
    expect(bilan).toEqual({ destinataires: 0, envoyes: 0, echecs: 0 })
  })
})
