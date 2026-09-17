// `notifier_moderation`: what the Arena tells about a take. The person hears every event about
// their own passage (flagged, published, withdrawn); on a flag the admins hear it too, since a
// decision now waits for them. Queued by `publier_prise()` and `moderer_prise()`, one job per
// event, so a retry after a crash mid-send never tells the same thing twice.
import {
  ChargeNotifierModerationSchema,
  MESSAGE_PRISE_PUBLIEE,
  MESSAGE_PRISE_RETIREE,
  MESSAGE_PRISE_SIGNALEE,
  MESSAGE_SIGNALEMENT_ADMIN,
  type EvenementModeration,
} from '@leq/domaine'
import { z } from 'zod'
import {
  lireProprietairePrisePublique,
  listerJetonsAdmins,
  listerJetonsDe,
  type Executeur,
} from '../db.js'
import { envoyerACesJetons, type EnvoyeurPush } from '../notifications/expoPush.js'
import type { HandlerJob } from './types.js'

export interface DependancesModeration {
  ex: Executeur
  envoyer: EnvoyeurPush
}

const MESSAGES: Readonly<Record<EvenementModeration, { titre: string; corps: string }>> = {
  signalee: MESSAGE_PRISE_SIGNALEE,
  publiee: MESSAGE_PRISE_PUBLIEE,
  retiree: MESSAGE_PRISE_RETIREE,
}

export function creerHandlerNotifierModeration(deps: DependancesModeration): HandlerJob {
  return async (job, contexte) => {
    const charge = ChargeNotifierModerationSchema.safeParse(job.charge)
    if (!charge.success) {
      throw new Error(`Invalid charge for notifier_moderation: ${z.prettifyError(charge.error)}`)
    }
    const { prise_id: priseId, evenement } = charge.data
    const journal = contexte.log.child({ prise_id: priseId, evenement })

    const proprietaire = await lireProprietairePrisePublique(deps.ex, priseId)
    if (proprietaire === null) {
      // The take is gone (an account deleted between the decision and this job): nobody to tell.
      journal.info('prise disparue, personne a prevenir')
      return
    }

    const jetons = await listerJetonsDe(deps.ex, proprietaire)
    const bilan = await envoyerACesJetons(
      deps,
      jetons,
      MESSAGES[evenement],
      { prise_id: priseId },
      journal,
    )
    journal.info({ destinataires: jetons.length, ...bilan }, 'la personne est prevenue')

    if (evenement === 'signalee') {
      const admins = await listerJetonsAdmins(deps.ex)
      const bilanAdmins = await envoyerACesJetons(
        deps,
        admins,
        MESSAGE_SIGNALEMENT_ADMIN,
        { moderation: true },
        journal,
      )
      journal.info({ destinataires: admins.length, ...bilanAdmins }, 'les admins sont prevenus')
    }
  }
}
