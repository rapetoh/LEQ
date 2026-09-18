// `notifier_duel`: what a duel tells its two sides (chapter 11, social events of chapter 12).
// Queued by `rejoindre_duel()` (rejoint), `publier_prise()` (repondu) and `cloturer_duel()`
// (verdict, expire), one job per event and actor, so a retry never tells the same thing twice.
// A person with the app is pushed when they keep the social switch on. An invitee who answered
// by the link has no app: on the verdict and on an expiry they get the e-mail the page promised
// when it asked for their address.
import {
  ChargeNotifierDuelSchema,
  courrielDuelTermine,
  lienInvitationDuel,
  messageDuelExpire,
  messageDuelRejoint,
  messageDuelRepondu,
  messageDuelVerdict,
  type IssueDuelPourMoi,
} from '@leq/domaine'
import { z } from 'zod'
import {
  lireDuelANotifier,
  listerJetonsSociauxDe,
  type DuelANotifier,
  type Executeur,
} from '../db.js'
import { envoyerCourriel, type EnvoyeurCourriel } from '../notifications/courriel.js'
import { envoyerACesJetons, type EnvoyeurPush } from '../notifications/expoPush.js'
import type { HandlerJob } from './types.js'

export interface DependancesNotifierDuel {
  ex: Executeur
  envoyer: EnvoyeurPush
  courriel: EnvoyeurCourriel | null
  urlPublique: string
}

type Cote = 'inviteur' | 'invite'

/** The outcome of a closed duel, read from one side. */
export function issuePour(duel: DuelANotifier, cote: Cote): IssueDuelPourMoi {
  if (duel.statut === 'expire') {
    const jaiParle = cote === 'inviteur' ? duel.a_parle_inviteur : duel.a_parle_invite
    return jaiParle ? 'expire_sans_reponse' : 'expire_sans_ma_reponse'
  }
  if (duel.verdict === 'egalite') return 'egalite'
  if (duel.verdict === 'sans_verdict' || duel.verdict === null) return 'sans_verdict'
  return duel.verdict === cote ? 'gagne' : 'perdu'
}

export function creerHandlerNotifierDuel(deps: DependancesNotifierDuel): HandlerJob {
  return async (job, contexte) => {
    const charge = ChargeNotifierDuelSchema.safeParse(job.charge)
    if (!charge.success) {
      throw new Error(`Invalid charge for notifier_duel: ${z.prettifyError(charge.error)}`)
    }
    const { duel_id: duelId, evenement, acteur_id: acteurId } = charge.data
    const journal = contexte.log.child({ duel_id: duelId, evenement })

    const duel = await lireDuelANotifier(deps.ex, duelId)
    if (duel === null) {
      journal.info('duel disparu, personne a prevenir')
      return
    }

    // Who hears it: the inviter when someone joins, the other side when one side answers, both
    // at the end. The actor of the gesture is never told about their own gesture.
    const cotes: Cote[] =
      evenement === 'rejoint'
        ? ['inviteur']
        : evenement === 'repondu'
          ? acteurId === duel.inviteur_id
            ? ['invite']
            : ['inviteur']
          : ['inviteur', 'invite']

    let pousses = 0
    let courriels = 0
    for (const cote of cotes) {
      const uid = cote === 'inviteur' ? duel.inviteur_id : duel.invite_id
      if (!uid) continue
      const autre = cote === 'inviteur' ? duel.invite_prenom : duel.inviteur_prenom
      const message =
        evenement === 'rejoint'
          ? messageDuelRejoint(autre)
          : evenement === 'repondu'
            ? messageDuelRepondu(autre)
            : evenement === 'verdict'
              ? messageDuelVerdict(autre)
              : messageDuelExpire(
                  autre,
                  cote === 'inviteur' ? duel.a_parle_inviteur : duel.a_parle_invite,
                )

      const jetons = await listerJetonsSociauxDe(deps.ex, uid)
      if (jetons.length > 0) {
        const bilan = await envoyerACesJetons(deps, jetons, message, { duel_id: duel.id }, journal)
        pousses += bilan.envoyes
      }

      // The invitee without the app gave an address so the end of the duel reaches them.
      const finDuDuel = evenement === 'verdict' || evenement === 'expire'
      if (cote === 'invite' && finDuDuel && duel.invite_anonyme && duel.invite_email) {
        const courriel = courrielDuelTermine({
          prenom: duel.invite_prenom,
          autre: duel.inviteur_prenom,
          sujet: duel.sujet,
          issue: issuePour(duel, 'invite'),
          lien: lienInvitationDuel(deps.urlPublique, duel.jeton),
        })
        if (await envoyerCourriel(deps.courriel, { a: duel.invite_email, ...courriel }, journal)) {
          courriels += 1
        }
      }
    }
    journal.info({ cotes: cotes.length, pousses, courriels }, 'duel: les deux cotes sont prevenus')
  }
}
