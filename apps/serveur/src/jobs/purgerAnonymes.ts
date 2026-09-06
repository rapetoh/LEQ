// purger_anonymes: anonymous auth users older than configuration.purge_anonymes_heures
// lose their storage objects, then their auth row (cascade removes the rest).
// One failure does not stop the others; the job fails at the end so it is retried.
import { lireConfigurationNombre, listerUtilisateursAnonymesExpires } from '../db.js'
import { messageErreur } from '../log.js'
import {
  supprimerDonneesUtilisateur,
  type DependancesSuppressionCompte,
} from './supprimerCompte.js'
import type { HandlerJob } from './types.js'

export const PURGE_ANONYMES_HEURES_DEFAUT = 72

export function creerHandlerPurgerAnonymes(deps: DependancesSuppressionCompte): HandlerJob {
  return async (_job, contexte) => {
    const heures = await lireConfigurationNombre(
      deps.ex,
      'purge_anonymes_heures',
      PURGE_ANONYMES_HEURES_DEFAUT,
    )
    const ids = await listerUtilisateursAnonymesExpires(deps.ex, heures)
    contexte.log.info({ heures, utilisateurs: ids.length }, 'purge des comptes anonymes')

    const echecs: string[] = []
    for (const id of ids) {
      try {
        await supprimerDonneesUtilisateur(deps, id, contexte.log)
      } catch (erreur) {
        contexte.log.error(
          { err: erreur, utilisateur_id: id },
          'purge impossible pour cet utilisateur',
        )
        echecs.push(`${id}: ${messageErreur(erreur, 200)}`)
      }
    }
    if (echecs.length > 0) {
      throw new Error(
        `purger_anonymes: ${echecs.length} of ${ids.length} failed. ${echecs.join(' | ')}`,
      )
    }
  }
}
