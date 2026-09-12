import { pino } from 'pino'
import { describe, expect, it } from 'vitest'
import type { Executeur } from '../db.js'
import {
  creerHandlerEnvoyerResultatArene,
  creerHandlerFermerDuels,
  creerHandlerRoterSujetArene,
  creerHandlerSupprimerAudioPublic,
} from './arene.js'

const log = pino({ level: 'silent' })
const contexte = { log, dernierEssai: false }
const job = { id: 1, type: 'arene', charge: {} } as never
const SUJET = '11111111-1111-4111-8111-111111111111'

function reponse(rows: unknown[]) {
  return { rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] } as never
}

describe('roter_sujet_arene', () => {
  it('calls the rotation and accepts an empty bank', async () => {
    const appels: string[] = []
    const ex: Executeur = {
      async query(text: string) {
        appels.push(text)
        if (text.includes('resultat_notifie_le is null')) return reponse([])
        return reponse([{ rotation: { ferme: null, actif: null } }])
      },
    }
    await creerHandlerRoterSujetArene({ ex, stockage: {} as never })(job, contexte)
    expect(appels[0]).toContain('roter_sujet_arene')
    expect(appels.some((a) => a.includes('into public.jobs'))).toBe(false)
  })

  it('queues the podium notification for the week it just closed', async () => {
    const jobs: Array<{ type: unknown; cle: unknown }> = []
    const ex: Executeur = {
      async query(text: string, values?: unknown[]) {
        if (text.includes('roter_sujet_arene')) {
          return reponse([{ rotation: { ferme: 's-close', actif: 's-neuf' } }])
        }
        if (text.includes('resultat_notifie_le is null')) return reponse([{ id: 's-close' }])
        jobs.push({ type: values?.[0], cle: values?.[2] })
        return reponse([])
      },
    }
    await creerHandlerRoterSujetArene({ ex, stockage: {} as never })(job, contexte)
    expect(jobs).toEqual([{ type: 'envoyer_resultat_arene', cle: 'resultat:s-close' }])
  })

  it('queues nothing while the week is still running', async () => {
    const jobs: unknown[] = []
    const ex: Executeur = {
      async query(text: string) {
        if (text.includes('roter_sujet_arene')) {
          return reponse([{ rotation: { ferme: null, actif: 's-en-cours' } }])
        }
        if (text.includes('resultat_notifie_le is null')) return reponse([])
        jobs.push(text)
        return reponse([])
      },
    }
    await creerHandlerRoterSujetArene({ ex, stockage: {} as never })(job, contexte)
    expect(jobs).toEqual([])
  })
})

describe('envoyer_resultat_arene', () => {
  const jobResultat = {
    id: 2,
    type: 'envoyer_resultat_arene',
    charge: { sujet_id: SUJET },
  } as never

  it('notifies every token of the week and stamps the tokens that answered', async () => {
    const marques: string[] = []
    const ex: Executeur = {
      async query(text: string, values?: unknown[]) {
        if (text.includes('reserver_resultat_arene')) return reponse([{ pris: true }])
        if (text.includes('jetons_push j')) {
          return reponse([
            { id: 'j1', jeton: 'ExponentPushToken[a]' },
            { id: 'j2', jeton: 'ExponentPushToken[b]' },
          ])
        }
        if (text.includes('update public.jetons_push')) {
          marques.push(String(values?.[0]))
          return reponse([])
        }
        throw new Error(`requête inattendue: ${text}`)
      },
    }
    const envoyes: unknown[] = []
    const envoyer = async (messages: Array<{ to: string; data: unknown }>) => {
      envoyes.push(...messages)
      return messages.map(() => ({ status: 'ok' as const }))
    }
    await creerHandlerEnvoyerResultatArene({ ex, envoyer })(jobResultat, contexte)
    expect(envoyes).toHaveLength(2)
    expect(envoyes[0]).toMatchObject({ data: { sujet_id: SUJET } })
    expect(marques).toEqual(['j1', 'j2'])
  })

  it('sends nothing when the week was already notified', async () => {
    const appels: string[] = []
    const ex: Executeur = {
      async query(text: string) {
        appels.push(text)
        return reponse([{ pris: false }])
      },
    }
    let envois = 0
    await creerHandlerEnvoyerResultatArene({
      ex,
      envoyer: async () => {
        envois += 1
        return []
      },
    })(jobResultat, contexte)
    expect(envois).toBe(0)
    expect(appels).toHaveLength(1)
  })

  it('refuses a charge without a subject rather than notifying at random', async () => {
    const ex: Executeur = {
      async query() {
        throw new Error('ne devrait pas être appelé')
      },
    }
    await expect(
      creerHandlerEnvoyerResultatArene({ ex, envoyer: async () => [] })(
        { id: 3, type: 'envoyer_resultat_arene', charge: {} } as never,
        contexte,
      ),
    ).rejects.toThrow(/envoyer_resultat_arene/)
  })
})

describe('fermer_duels', () => {
  it('closes every duel the database lists and reports the ones that fail', async () => {
    const fermes: string[] = []
    const ex: Executeur = {
      async query(text: string, values?: unknown[]) {
        if (text.includes('from public.duels')) return reponse([{ id: 'd1' }, { id: 'd2' }])
        if (text.includes('cloturer_duel')) {
          const id = String(values?.[0])
          if (id === 'd2') throw new Error('verrou')
          fermes.push(id)
          return reponse([{ verdict: 'inviteur' }])
        }
        throw new Error(`requête inattendue: ${text}`)
      },
    }
    await expect(
      creerHandlerFermerDuels({ ex, stockage: {} as never })(job, contexte),
    ).rejects.toThrow(/d2/)
    expect(fermes).toEqual(['d1'])
  })

  it('does nothing when no duel is due', async () => {
    const ex: Executeur = {
      async query() {
        return reponse([])
      },
    }
    await expect(
      creerHandlerFermerDuels({ ex, stockage: {} as never })(job, contexte),
    ).resolves.toBeUndefined()
  })
})

describe('supprimer_audio_public', () => {
  it('deletes the audio of every take marked for deletion and stamps the row', async () => {
    const supprimes: string[] = []
    const marques: string[] = []
    const ex: Executeur = {
      async query(text: string, values?: unknown[]) {
        if (text.includes('from public.prises_publiques')) {
          return reponse([
            { id: 'p1', chemin_audio: 'u1/p1.m4a' },
            { id: 'p2', chemin_audio: null },
          ])
        }
        if (text.includes('update public.prises_publiques')) {
          marques.push(String(values?.[0]))
          return reponse([])
        }
        throw new Error(`requête inattendue: ${text}`)
      },
    }
    const stockage = {
      supprimer: async (_bucket: string, chemins: string[]) => {
        supprimes.push(...chemins)
      },
    } as never
    await creerHandlerSupprimerAudioPublic({ ex, stockage })(job, contexte)
    expect(supprimes).toEqual(['u1/p1.m4a'])
    expect(marques).toEqual(['p1', 'p2'])
  })
})

// The rotation reports a week as closed exactly once. A failure between closing it and queueing
// the notification would otherwise lose that week's podium for good.
describe('le rattrapage des résultats de semaine', () => {
  it('reprend une semaine fermée dont le podium n a jamais été annoncé', async () => {
    const jobs: Array<{ type: unknown; cle: unknown }> = []
    const ex: Executeur = {
      async query(text: string, values?: unknown[]) {
        if (text.includes('roter_sujet_arene')) {
          return reponse([{ rotation: { ferme: null, actif: 's-en-cours' } }])
        }
        if (text.includes('resultat_notifie_le is null')) return reponse([{ id: 's-oubliee' }])
        jobs.push({ type: values?.[0], cle: values?.[2] })
        return reponse([])
      },
    }
    await creerHandlerRoterSujetArene({ ex, stockage: {} as never })(job, contexte)
    expect(jobs).toEqual([{ type: 'envoyer_resultat_arene', cle: 'resultat:s-oubliee' }])
  })

  it('ne double pas la semaine qu il vient lui-même de fermer', async () => {
    const jobs: unknown[] = []
    const ex: Executeur = {
      async query(text: string, values?: unknown[]) {
        if (text.includes('roter_sujet_arene')) {
          return reponse([{ rotation: { ferme: 's-close', actif: 's-neuf' } }])
        }
        if (text.includes('resultat_notifie_le is null')) return reponse([{ id: 's-close' }])
        jobs.push(values?.[2])
        return reponse([])
      },
    }
    await creerHandlerRoterSujetArene({ ex, stockage: {} as never })(job, contexte)
    expect(jobs).toEqual(['resultat:s-close'])
  })
})
