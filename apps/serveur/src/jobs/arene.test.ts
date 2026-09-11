import { pino } from 'pino'
import { describe, expect, it } from 'vitest'
import type { Executeur } from '../db.js'
import {
  creerHandlerFermerDuels,
  creerHandlerRoterSujetArene,
  creerHandlerSupprimerAudioPublic,
} from './arene.js'

const log = pino({ level: 'silent' })
const contexte = { log, dernierEssai: false }
const job = { id: 1, type: 'arene', charge: {} } as never

function reponse(rows: unknown[]) {
  return { rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] } as never
}

describe('roter_sujet_arene', () => {
  it('calls the rotation and accepts an empty bank', async () => {
    const appels: string[] = []
    const ex: Executeur = {
      async query(text: string) {
        appels.push(text)
        return reponse([{ sujet: null }])
      },
    }
    await creerHandlerRoterSujetArene({ ex, stockage: {} as never })(job, contexte)
    expect(appels[0]).toContain('roter_sujet_arene')
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
