// Composition root of the worker: wires real dependencies into every job handler.
import type { Pool } from 'pg'
import { creerDecodeur } from '../audio/decoder.js'
import { ExtracteurProsodiePraat } from '../audio/prosodie.js'
import type { Config } from '../config.js'
import { creerLogger } from '../log.js'
import { evaluerRegle, mesurer } from '../contrat.js'
import * as db from '../db.js'
import type { TypeJob } from '../db.js'
import { BUCKET_AUDIO_TENTATIVES, type Comptes, type Stockage } from '../stockage.js'
import { choisirTranscripteur } from '../transcription/index.js'
import { envoyerViaExpo, notifierRetourPret } from '../notifications/expoPush.js'
import { creerHandlerAnalyserTentative, type DepotAnalyse } from './analyserTentative.js'
import { creerHandlerBalayerAudio } from './balayerAudio.js'
import { creerHandlerPurgerAnonymes } from './purgerAnonymes.js'
import { creerHandlerSupprimerCompte } from './supprimerCompte.js'
import type { HandlerJob } from './types.js'

export type { ContexteJob, HandlerJob } from './types.js'

export interface DependancesHandlers {
  config: Config
  pool: Pool
  stockage: Stockage
  comptes: Comptes
}

export function creerDepotAnalyse(pool: Pool): DepotAnalyse {
  return {
    lireTentative: (id) => db.lireTentative(pool, id),
    mettreAJourStatut: (id, statut) => db.mettreAJourStatut(pool, id, statut),
    mettreAJourDuree: (id, dureeS) => db.mettreAJourDuree(pool, id, dureeS),
    lireGrillePubliee: () => db.lireGrillePubliee(pool),
    enregistrerAnalyseEtEvaluation: (analyse, evaluation) =>
      db.enregistrerAnalyseEtEvaluation(pool, analyse, evaluation),
    marquerAudioSupprime: (id) => db.marquerAudioSupprime(pool, id),
    marquerEchecTechnique: (id, erreur) => db.marquerEchecTechnique(pool, id, erreur),
    marquerAbandonTechnique: (id, audioSupprime, erreur) =>
      db.marquerAbandonTechnique(pool, id, audioSupprime, erreur),
  }
}

export function creerHandlers(deps: DependancesHandlers): Record<TypeJob, HandlerJob> {
  const { config, pool, stockage, comptes } = deps
  const suppression = { ex: pool, stockage, comptes }
  return {
    analyser_tentative: creerHandlerAnalyserTentative({
      depot: creerDepotAnalyse(pool),
      stockage: {
        telecharger: (chemin) => stockage.telecharger(BUCKET_AUDIO_TENTATIVES, chemin),
        supprimer: (chemin) => stockage.supprimer(BUCKET_AUDIO_TENTATIVES, [chemin]),
      },
      notifier: (utilisateurId, tentativeId) =>
        notifierRetourPret(
          {
            ex: pool,
            envoyer: envoyerViaExpo,
            log: creerLogger(config.logLevel, { module: 'push' }),
          },
          utilisateurId,
          tentativeId,
        ),
      transcripteur: choisirTranscripteur(config.transcripteur),
      decoder: creerDecodeur({ ffmpegPath: config.ffmpegPath, delaiMs: config.delaiOutilMs }),
      prosodie: new ExtracteurProsodiePraat({
        pythonPath: config.pythonPath,
        scriptPath: config.prosodieScript,
        delaiMs: config.delaiOutilMs,
      }),
      mesurer,
      evaluerRegle,
    }),
    supprimer_compte: creerHandlerSupprimerCompte(suppression),
    balayer_audio: creerHandlerBalayerAudio({ ex: pool, stockage }),
    purger_anonymes: creerHandlerPurgerAnonymes(suppression),
  }
}
