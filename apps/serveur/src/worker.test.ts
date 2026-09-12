import { pino } from 'pino'
import { describe, expect, it } from 'vitest'
import type { Job } from './db.js'
import { Worker, type DependancesWorker } from './worker.js'

const log = pino({ level: 'silent' })

function job(type: string, essais = 1, essais_max = 5): Job {
  return {
    id: 7,
    type,
    charge: {},
    statut: 'en_cours',
    essais,
    essais_max,
    disponible_a: new Date(),
    verrouille_a: new Date(),
    verrouille_par: 'test',
    erreur: null,
    cle_idempotence: null,
    termine_le: null,
    cree_le: new Date(),
  }
}

function construire(files: (Job | null)[], handler: DependancesWorker['handlers'][string]) {
  const appels: string[] = []
  const deps: DependancesWorker = {
    reclamer: async (types) => {
      appels.push(`reclamer:${types.join(',')}`)
      return files.shift() ?? null
    },
    terminer: async (id) => {
      appels.push(`terminer:${id}`)
    },
    echouer: async (id, erreur) => {
      appels.push(`echouer:${id}:${erreur}`)
    },
    handlers: { analyser_tentative: handler },
    log,
    intervalleInactifMs: 1,
  }
  return { worker: new Worker(deps), appels }
}

describe('Worker', () => {
  it('claims only the handled types, runs the handler, then terminates the job', async () => {
    let dernierEssai: boolean | undefined
    const { worker, appels } = construire(
      [job('analyser_tentative', 5, 5)],
      async (_job, contexte) => {
        dernierEssai = contexte.dernierEssai
      },
    )
    expect(await worker.iteration()).toBe('traite')
    expect(appels).toEqual(['reclamer:analyser_tentative', 'terminer:7'])
    expect(dernierEssai).toBe(true)
  })

  it('reports a failing handler through echouer with the error message', async () => {
    const { worker, appels } = construire([job('analyser_tentative')], async () => {
      throw new Error('panne')
    })
    expect(await worker.iteration()).toBe('traite')
    expect(appels).toEqual(['reclamer:analyser_tentative', 'echouer:7:Error: panne'])
  })

  it('is idle on an empty queue and stops cleanly', async () => {
    const { worker, appels } = construire([null, null], async () => undefined)
    expect(await worker.iteration()).toBe('inactif')
    const boucle = worker.demarrer()
    await new Promise((r) => setTimeout(r, 5))
    worker.arreter()
    await boucle
    expect(appels.every((a) => a.startsWith('reclamer:'))).toBe(true)
  })
})

// A `terminer` that could not be written used to send the loop into the catch, so a job that had
// done its work was recorded as failed and ran a second time. An announcement went out twice.
describe('quand la file est injoignable après le travail', () => {
  it('ne marque pas en échec un job qui a réussi', async () => {
    const echecs: Array<{ id: number; erreur: string }> = []
    let travaux = 0
    const worker = new Worker({
      reclamer: async () => job('analyser_tentative'),
      terminer: async () => {
        throw new Error('base injoignable')
      },
      echouer: async (id, erreur) => {
        echecs.push({ id, erreur })
      },
      handlers: {
        analyser_tentative: async () => {
          travaux += 1
        },
      },
      log,
      intervalleInactifMs: 1,
    })
    await expect(worker.iteration()).rejects.toThrow('base injoignable')
    expect(travaux).toBe(1)
    expect(echecs).toEqual([])
  })
})
