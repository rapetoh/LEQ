import type { Job } from '../db.js'
import type { Logger } from '../log.js'

export interface ContexteJob {
  log: Logger
  /** True when reclamer_job handed out the last allowed try (essais >= essais_max). */
  dernierEssai: boolean
}

/** Runs one job. Throwing means failure: the worker calls echouer_job, which retries with backoff. */
export type HandlerJob = (job: Job, contexte: ContexteJob) => Promise<void>
