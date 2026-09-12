// Arena and duels, the scheduled side (cahier chapter 11):
//   - roter_sujet_arene: closes the week that is over and activates the next subject, and
//     queues the podium notification for the week it closed (C8);
//   - envoyer_resultat_arene: that notification, to the people who spoke that week and keep
//     the social switch on (chapter 12);
//   - fermer_duels: closes a duel once both have spoken, or expires it at the deadline;
//   - supprimer_audio_public: deletes the audio of takes marked for deletion (a closed week,
//     a finished duel, a withdrawn take). Rows stay: the ranking is never lost.
// The database holds the rules; these handlers only call them and delete what SQL cannot.
import { MESSAGE_RESULTAT_ARENE } from '@leq/domaine'
import { z } from 'zod'
import {
  creerJob,
  fermerDuel,
  listerSujetsSansResultat,
  listerDuelsAFermer,
  listerJetonsPourResultatArene,
  listerPrisesPubliquesASupprimer,
  marquerAudioPublicSupprime,
  reserverResultatArene,
  roterSujetArene,
  type Executeur,
} from '../db.js'
import { messageErreur } from '../log.js'
import { envoyerACesJetons, type EnvoyeurPush } from '../notifications/expoPush.js'
import { BUCKET_AUDIO_PUBLIC, type Stockage } from '../stockage.js'
import type { HandlerJob } from './types.js'

export interface DependancesArene {
  ex: Executeur
  stockage: Stockage
}

export function creerHandlerRoterSujetArene(deps: DependancesArene): HandlerJob {
  return async (_job, contexte) => {
    const { ferme, actif } = await roterSujetArene(deps.ex)
    if (ferme) {
      // The podium is notified by its own job: a push that fails must not undo a rotation
      // that succeeded, and the claim inside that job makes a retry safe.
      await creerJob(deps.ex, 'envoyer_resultat_arene', { sujet_id: ferme }, `resultat:${ferme}`)
    }
    // The rotation reports a week as closed exactly once, so if queueing the notification had
    // failed here the retry would see the new week running, report nothing closed, and that
    // week's podium would never be announced. Any week that closed without its notification is
    // picked up on the next pass instead, which is every hour.
    const oublies = await listerSujetsSansResultat(deps.ex)
    for (const sujet of oublies) {
      if (sujet === ferme) continue
      await creerJob(deps.ex, 'envoyer_resultat_arene', { sujet_id: sujet }, `resultat:${sujet}`)
      contexte.log.warn({ sujet_id: sujet }, 'resultat de semaine rattrape')
    }
    contexte.log.info(
      { sujet_ferme: ferme, sujet_actif: actif, rattrapes: oublies.length },
      actif ? 'sujet actif' : 'banque de sujets vide',
    )
  }
}

export interface DependancesResultatArene {
  ex: Executeur
  envoyer: EnvoyeurPush
}

const SchemaChargeResultat = z.object({ sujet_id: z.uuid() })

/**
 * C8: the week is over, the votes are counted. Only the people who spoke that week are told,
 * and only those who keep the social events switch on. Claimed before the first push leaves,
 * so a retry after a crash mid-send never notifies the same week twice.
 */
export function creerHandlerEnvoyerResultatArene(deps: DependancesResultatArene): HandlerJob {
  return async (job, contexte) => {
    const charge = SchemaChargeResultat.safeParse(job.charge)
    if (!charge.success) {
      throw new Error(`Invalid charge for envoyer_resultat_arene: ${z.prettifyError(charge.error)}`)
    }
    const sujetId = charge.data.sujet_id
    const journal = contexte.log.child({ sujet_id: sujetId })
    if (!(await reserverResultatArene(deps.ex, sujetId))) {
      journal.info('resultat deja notifie, rien a envoyer')
      return
    }
    const jetons = await listerJetonsPourResultatArene(deps.ex, sujetId)
    if (jetons.length === 0) {
      journal.info('personne a prevenir')
      return
    }
    const bilan = await envoyerACesJetons(
      deps,
      jetons,
      MESSAGE_RESULTAT_ARENE,
      { sujet_id: sujetId },
      journal,
    )
    journal.info({ destinataires: jetons.length, ...bilan }, 'resultat de la semaine envoye')
  }
}

export function creerHandlerFermerDuels(deps: DependancesArene): HandlerJob {
  return async (_job, contexte) => {
    const duels = await listerDuelsAFermer(deps.ex)
    if (duels.length === 0) {
      contexte.log.info('aucun duel a fermer')
      return
    }
    const echecs: string[] = []
    for (const duel of duels) {
      try {
        const verdict = await fermerDuel(deps.ex, duel)
        contexte.log.info({ duel_id: duel, verdict }, 'duel traite')
      } catch (erreur) {
        contexte.log.error({ err: erreur, duel_id: duel }, 'fermeture impossible')
        echecs.push(`${duel}: ${messageErreur(erreur)}`)
      }
    }
    if (echecs.length > 0) throw new Error(`Fermeture de duels en echec: ${echecs.join(' | ')}`)
  }
}

export function creerHandlerSupprimerAudioPublic(deps: DependancesArene): HandlerJob {
  return async (_job, contexte) => {
    const prises = await listerPrisesPubliquesASupprimer(deps.ex)
    if (prises.length === 0) {
      contexte.log.info('aucun audio public a supprimer')
      return
    }
    const echecs: string[] = []
    for (const prise of prises) {
      try {
        if (prise.chemin_audio)
          await deps.stockage.supprimer(BUCKET_AUDIO_PUBLIC, [prise.chemin_audio])
        await marquerAudioPublicSupprime(deps.ex, prise.id)
      } catch (erreur) {
        contexte.log.error({ err: erreur, prise_id: prise.id }, 'suppression impossible')
        echecs.push(`${prise.id}: ${messageErreur(erreur)}`)
      }
    }
    contexte.log.info({ supprimes: prises.length - echecs.length }, 'audio public supprime')
    if (echecs.length > 0) throw new Error(`Suppressions en echec: ${echecs.join(' | ')}`)
  }
}
