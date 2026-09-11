// Arena and duels, the scheduled side (cahier chapter 11):
//   - roter_sujet_arene: closes the week that is over and activates the next subject;
//   - fermer_duels: closes a duel once both have spoken, or expires it at the deadline;
//   - supprimer_audio_public: deletes the audio of takes marked for deletion (a closed week,
//     a finished duel, a withdrawn take). Rows stay: the ranking is never lost.
// The database holds the rules; these handlers only call them and delete what SQL cannot.
import {
  fermerDuel,
  listerDuelsAFermer,
  listerPrisesPubliquesASupprimer,
  marquerAudioPublicSupprime,
  roterSujetArene,
  type Executeur,
} from '../db.js'
import { messageErreur } from '../log.js'
import { BUCKET_AUDIO_PUBLIC, type Stockage } from '../stockage.js'
import type { HandlerJob } from './types.js'

export interface DependancesArene {
  ex: Executeur
  stockage: Stockage
}

export function creerHandlerRoterSujetArene(deps: DependancesArene): HandlerJob {
  return async (_job, contexte) => {
    const sujet = await roterSujetArene(deps.ex)
    contexte.log.info({ sujet_id: sujet }, sujet ? 'sujet actif' : 'banque de sujets vide')
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
