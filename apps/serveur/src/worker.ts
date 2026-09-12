// The worker loop: claim one job of a handled type, run it, terminer_job or
// echouer_job, sleep when the queue is empty, stop cleanly on request.
import type { Job } from './db.js'
import type { HandlerJob } from './jobs/types.js'
import { messageErreur, type Logger } from './log.js'

export interface DependancesWorker {
  reclamer(types: readonly string[]): Promise<Job | null>
  terminer(id: number): Promise<void>
  echouer(id: number, erreur: string): Promise<void>
  handlers: Record<string, HandlerJob>
  log: Logger
  intervalleInactifMs: number
}

export type ResultatIteration = 'traite' | 'inactif'

export class Worker {
  private actif = false
  private reveiller: (() => void) | null = null
  private readonly types: string[]

  constructor(private readonly deps: DependancesWorker) {
    this.types = Object.keys(deps.handlers)
  }

  /** One claim. Returns 'inactif' when the queue had nothing for us. */
  async iteration(): Promise<ResultatIteration> {
    const job = await this.deps.reclamer(this.types)
    if (!job) return 'inactif'

    const log = this.deps.log.child({
      job_id: job.id,
      type: job.type,
      essai: job.essais,
      essais_max: job.essais_max,
    })
    const handler = this.deps.handlers[job.type]
    if (!handler) {
      log.error('aucun handler pour ce type de job')
      await this.deps.echouer(job.id, `No handler for job type ${job.type}`)
      return 'traite'
    }

    const debut = Date.now()
    log.info('job demarre')
    // The work and the bookkeeping are separated on purpose. Both used to sit in one try, so a
    // `terminer` that could not be written sent the loop into the catch and recorded a job that
    // had done its work as failed, which then ran it again.
    let echec: string | null = null
    try {
      await handler(job, { log, dernierEssai: job.essais >= job.essais_max })
    } catch (erreur) {
      echec = messageErreur(erreur)
      log.error({ err: erreur, duree_ms: Date.now() - debut }, 'job echoue')
    }
    if (echec === null) {
      // If this throws, the job stays claimed and the claim expires on its own: it comes back
      // once, rather than being written down as a failure it never was.
      await this.deps.terminer(job.id)
      log.info({ duree_ms: Date.now() - debut }, 'job termine')
    } else {
      await this.deps.echouer(job.id, echec)
    }
    return 'traite'
  }

  /** Runs until arreter() is called. Resolves once the current job, if any, is finished. */
  async demarrer(): Promise<void> {
    this.actif = true
    this.deps.log.info({ types: this.types }, 'worker demarre')
    while (this.actif) {
      let resultat: ResultatIteration
      try {
        resultat = await this.iteration()
      } catch (erreur) {
        // reclamer/terminer/echouer failed (database unreachable): wait, then try again.
        this.deps.log.error({ err: erreur }, 'iteration du worker en erreur')
        resultat = 'inactif'
      }
      if (resultat === 'inactif' && this.actif) await this.dormir(this.deps.intervalleInactifMs)
    }
    this.deps.log.info('worker arrete')
  }

  /** Asks the loop to stop after the current job. Wakes it up if it is sleeping. */
  arreter(): void {
    this.actif = false
    this.reveiller?.()
  }

  private dormir(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const minuteur = setTimeout(() => {
        this.reveiller = null
        resolve()
      }, ms)
      this.reveiller = () => {
        clearTimeout(minuteur)
        this.reveiller = null
        resolve()
      }
    })
  }
}
