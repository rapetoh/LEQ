// Entry point. HTTP always; the worker loop only when PROCESS=worker.
import { chargerConfig } from './config.js'
import * as db from './db.js'
import { creerPool, echouerJob, reclamerJob, terminerJob, TYPES_JOB } from './db.js'
import {
  Conduite,
  choisirAdversaire,
  choisirTranscripteurFlux,
  choisirVoix,
  type Canal,
} from './debat/index.js'
import { attendreFermeturesDebats, demarrerHttp } from './http.js'
import { creerHandlers } from './jobs/index.js'
import { creerLogger } from './log.js'
import { creerClientSupabase, creerComptes, creerStockage } from './stockage.js'
import { Worker } from './worker.js'

const DELAI_ARRET_MS = 30_000

async function principal(): Promise<void> {
  const config = chargerConfig()
  const log = creerLogger(config.logLevel, {
    processus: config.processus,
    worker_id: config.workerId,
  })

  const fermetures: Array<() => Promise<void>> = []
  let boucle: Promise<void> = Promise.resolve()
  let worker: Worker | undefined

  // The public process runs the face-à-face: one session per socket, over its own pool.
  let debat: { creerConduite(canal: Canal): Conduite } | undefined
  if (config.processus === 'temps-reel') {
    const pool = creerPool(config.databaseUrl)
    const supabase = creerClientSupabase(config.supabaseUrl, config.supabaseSecretKey)
    const journalDebat = creerLogger(config.logLevel, { module: 'debat' })
    const adversaire = choisirAdversaire(config.adversaire)
    debat = {
      creerConduite: (canal) =>
        new Conduite(
          {
            depot: {
              utilisateurDuJeton: async (jeton) => {
                const { data, error } = await supabase.auth.getUser(jeton)
                return error ? null : (data.user?.id ?? null)
              },
              lireDebat: (id, uid) => db.lireDebatOuvert(pool, id, uid),
              lireTours: (id) => db.lireToursDebat(pool, id),
              ecrireTour: (id, numero, locuteur, texte, dureeS) =>
                db.enregistrerTourDebat(pool, id, numero, locuteur, texte, dureeS),
              cloturer: (id, issue) => db.cloturerDebat(pool, id, issue),
              reprendre: (id) => db.reprendreDebat(pool, id),
              demanderDebrief: (id) =>
                db.creerJob(pool, 'debriefer_debat', { debat_id: id }, `debrief:${id}`),
            },
            transcripteur: choisirTranscripteurFlux(config.transcripteurFlux),
            adversaire,
            voix: choisirVoix(config.voix),
            log: journalDebat,
          },
          canal,
        ),
    }
    fermetures.push(() => pool.end())
    log.info(
      {
        transcripteur: config.transcripteurFlux,
        adversaire: config.adversaire,
        voix: config.voix,
      },
      'face-a-face pret',
    )
  }

  const http = demarrerHttp(config, log, debat)
  // Order matters on the way out: close the sockets, let every debate finish writing its
  // outcome, and only then end the pool. The other way round charged a session to everyone who
  // was mid-debate during a deploy.
  fermetures.unshift(http.fermer, attendreFermeturesDebats)

  if (config.processus === 'worker') {
    const pool = creerPool(config.databaseUrl)
    const supabase = creerClientSupabase(config.supabaseUrl, config.supabaseSecretKey)
    const handlers = creerHandlers({
      config,
      pool,
      stockage: creerStockage(supabase),
      comptes: creerComptes(supabase),
    })
    worker = new Worker({
      reclamer: (types) => reclamerJob(pool, config.workerId, types),
      terminer: (id) => terminerJob(pool, id),
      echouer: (id, erreur) => echouerJob(pool, id, erreur),
      handlers,
      log,
      intervalleInactifMs: config.intervalleInactifMs,
    })
    log.info({ types: TYPES_JOB }, 'types de jobs pris en charge')
    boucle = worker.demarrer()
    fermetures.push(() => pool.end())
  }

  let arretDemande = false
  const arreter = (signal: NodeJS.Signals): void => {
    if (arretDemande) return
    arretDemande = true
    log.info({ signal }, 'arret demande')
    const limite = setTimeout(() => {
      log.error('arret force apres le delai')
      process.exit(1)
    }, DELAI_ARRET_MS)
    limite.unref()

    worker?.arreter()
    void boucle
      .catch((erreur: unknown) =>
        log.error({ err: erreur }, 'la boucle du worker s est terminee en erreur'),
      )
      .then(async () => {
        for (const fermer of fermetures) {
          try {
            await fermer()
          } catch (erreur) {
            log.error({ err: erreur }, 'fermeture en erreur')
          }
        }
        log.info('arret termine')
        process.exit(0)
      })
  }
  process.once('SIGTERM', arreter)
  process.once('SIGINT', arreter)

  process.on('unhandledRejection', (raison) => {
    log.fatal({ err: raison }, 'promesse rejetee sans gestion')
    process.exit(1)
  })
}

principal().catch((erreur: unknown) => {
  console.error(erreur instanceof Error ? erreur.message : erreur)
  process.exit(1)
})
