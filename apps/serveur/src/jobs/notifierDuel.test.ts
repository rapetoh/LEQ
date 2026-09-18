import { pino } from 'pino'
import { describe, expect, it } from 'vitest'
import type { Executeur, Job } from '../db.js'
import { creerHandlerNotifierDuel, issuePour } from './notifierDuel.js'

const log = pino({ level: 'silent' })
const DUEL = '3f7b7d2e-4c8a-4d7e-9a3f-1e2d3c4b5a69'
const INVITEUR = '11111111-1111-4111-8111-111111111111'
const INVITE = '22222222-2222-4222-8222-222222222222'

type LigneDuel = {
  statut: string
  verdict: string | null
  invite_anonyme: boolean
  invite_email: string | null
  a_parle_inviteur: boolean
  a_parle_invite: boolean
}

/** A database with one duel, Roch inviting Rebecca; each side holds one token, social on. */
function fausseBase(
  duel: LigneDuel | null,
  jetons: Record<string, string[]> = { [INVITEUR]: ['roch'], [INVITE]: ['rebecca'] },
) {
  const ex: Executeur = {
    async query(text: string, values?: unknown[]) {
      const ligne = (rows: unknown[]) =>
        ({ rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] }) as never
      if (text.includes('from public.duels d')) {
        return ligne(
          duel === null
            ? []
            : [
                {
                  id: DUEL,
                  sujet: 'Le silence est-il une réponse ?',
                  jeton: 'abc',
                  inviteur_id: INVITEUR,
                  invite_id: INVITE,
                  inviteur_prenom: 'Roch',
                  invite_prenom: 'Rebecca',
                  ...duel,
                },
              ],
        )
      }
      if (text.includes('from public.jetons_push j')) {
        const uid = String(values?.[0])
        return ligne(
          (jetons[uid] ?? []).map((j) => ({ id: `id-${j}`, jeton: `ExponentPushToken[${j}]` })),
        )
      }
      if (text.includes('update public.jetons_push')) return ligne([])
      throw new Error(`requête inattendue: ${text}`)
    },
  }
  return ex
}

function job(evenement: string, acteurId?: string): Job {
  return {
    id: 1,
    type: 'notifier_duel',
    charge: { duel_id: DUEL, evenement, ...(acteurId ? { acteur_id: acteurId } : {}) },
    essais: 0,
  } as unknown as Job
}

function handler(
  base: Executeur,
  courriels: Array<{ a: string; sujet: string; texte: string }>,
  envoyes: Array<{ to: string; title: string; body: string }>,
) {
  return creerHandlerNotifierDuel({
    ex: base,
    envoyer: async (messages) => {
      envoyes.push(...messages.map((m) => ({ to: m.to, title: m.title, body: m.body })))
      return messages.map(() => ({ status: 'ok' as const, id: 'x' }))
    },
    courriel: async (c) => {
      courriels.push(c)
    },
    urlPublique: 'https://leq.test',
  })
}

const OUVERT: LigneDuel = {
  statut: 'ouvert',
  verdict: null,
  invite_anonyme: false,
  invite_email: null,
  a_parle_inviteur: false,
  a_parle_invite: false,
}

describe('notifier_duel', () => {
  it('tells the inviter, by name, that someone joined', async () => {
    const envoyes: Array<{ to: string; title: string; body: string }> = []
    await handler(
      fausseBase(OUVERT),
      [],
      envoyes,
    )(job('rejoint', INVITE), { log, dernierEssai: false })
    expect(envoyes).toEqual([
      {
        to: 'ExponentPushToken[roch]',
        title: 'Rebecca a rejoint ton duel',
        body: 'À vous deux de parler.',
      },
    ])
  })

  it('tells the other side that this one has answered, never the one who spoke', async () => {
    const envoyes: Array<{ to: string; title: string; body: string }> = []
    await handler(
      fausseBase({ ...OUVERT, a_parle_invite: true }),
      [],
      envoyes,
    )(job('repondu', INVITE), {
      log,
      dernierEssai: false,
    })
    expect(envoyes.map((e) => e.to)).toEqual(['ExponentPushToken[roch]'])
    expect(envoyes[0]?.title).toBe('Rebecca a répondu')
  })

  it('tells both sides the verdict, without saying who won', async () => {
    const envoyes: Array<{ to: string; title: string; body: string }> = []
    const clos: LigneDuel = {
      ...OUVERT,
      statut: 'clos',
      verdict: 'invite',
      a_parle_inviteur: true,
      a_parle_invite: true,
    }
    await handler(fausseBase(clos), [], envoyes)(job('verdict'), { log, dernierEssai: false })
    expect(envoyes.map((e) => e.to).sort()).toEqual([
      'ExponentPushToken[rebecca]',
      'ExponentPushToken[roch]',
    ])
    for (const e of envoyes) {
      expect(e.title).toBe('Le duel est terminé')
      expect(e.body).not.toMatch(/gagne/)
    }
  })

  it('e-mails an invitee who answered by the link and has no app, with the outcome in words', async () => {
    const envoyes: Array<{ to: string; title: string; body: string }> = []
    const courriels: Array<{ a: string; sujet: string; texte: string }> = []
    const clos: LigneDuel = {
      statut: 'clos',
      verdict: 'invite',
      invite_anonyme: true,
      invite_email: 'rebecca@test.leq',
      a_parle_inviteur: true,
      a_parle_invite: true,
    }
    await handler(
      fausseBase(clos, { [INVITEUR]: ['roch'] }),
      courriels,
      envoyes,
    )(job('verdict'), {
      log,
      dernierEssai: false,
    })
    expect(envoyes.map((e) => e.to)).toEqual(['ExponentPushToken[roch]'])
    expect(courriels).toHaveLength(1)
    expect(courriels[0]?.a).toBe('rebecca@test.leq')
    expect(courriels[0]?.sujet).toBe('Ton duel avec Roch est terminé')
    expect(courriels[0]?.texte).toContain('Tu gagnes.')
    expect(courriels[0]?.texte).toContain('https://leq.test/duel/abc')
  })

  it('says on an expiry who stayed silent, from each side', async () => {
    const envoyes: Array<{ to: string; title: string; body: string }> = []
    const expire: LigneDuel = {
      ...OUVERT,
      statut: 'expire',
      a_parle_inviteur: true,
      a_parle_invite: false,
    }
    await handler(fausseBase(expire), [], envoyes)(job('expire'), { log, dernierEssai: false })
    const roch = envoyes.find((e) => e.to === 'ExponentPushToken[roch]')
    const rebecca = envoyes.find((e) => e.to === 'ExponentPushToken[rebecca]')
    expect(roch?.body).toBe("Rebecca n'a pas répondu à temps.")
    expect(rebecca?.body).toBe("Tu n'as pas répondu à temps.")
  })

  it('does nothing when the duel is gone', async () => {
    const envoyes: Array<{ to: string; title: string; body: string }> = []
    await handler(fausseBase(null), [], envoyes)(job('verdict'), { log, dernierEssai: false })
    expect(envoyes).toEqual([])
  })

  it('reads the outcome from each side', () => {
    const base = {
      id: DUEL,
      sujet: '',
      jeton: '',
      inviteur_id: INVITEUR,
      invite_id: INVITE,
      inviteur_prenom: null,
      invite_prenom: null,
      invite_email: null,
      invite_anonyme: false,
      a_parle_inviteur: true,
      a_parle_invite: true,
    }
    expect(issuePour({ ...base, statut: 'clos', verdict: 'inviteur' }, 'inviteur')).toBe('gagne')
    expect(issuePour({ ...base, statut: 'clos', verdict: 'inviteur' }, 'invite')).toBe('perdu')
    expect(issuePour({ ...base, statut: 'clos', verdict: 'sans_verdict' }, 'invite')).toBe(
      'sans_verdict',
    )
    expect(
      issuePour({ ...base, statut: 'expire', verdict: null, a_parle_invite: false }, 'invite'),
    ).toBe('expire_sans_ma_reponse')
    expect(
      issuePour({ ...base, statut: 'expire', verdict: null, a_parle_invite: false }, 'inviteur'),
    ).toBe('expire_sans_reponse')
  })
})
