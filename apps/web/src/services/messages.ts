// Turning a duel row into the sentence the person reads. Kept out of the page so the wording
// can be checked on its own, which is where wording mistakes actually hide.
import { fr } from '../fr'
import { resteAvant } from './delai'
import type { IssueDuel } from './duel'

/** What is left of the 48 hours. Under an hour, a number would read as plenty of time. */
export function texteDelai(echeance: string, maintenant: Date = new Date()): string {
  const reste = resteAvant(echeance, maintenant)
  if (reste.etat === 'heures') return fr.duel.delai(`${reste.heures} h`)
  return fr.duel.delaiCourt
}

/**
 * The verdict, said from the invitee's side: this page is only ever read by the invitee.
 * A closed duel without a verdict is one nobody answered, so it expired.
 */
export function texteVerdict(duel: IssueDuel): string {
  if (duel.statut === 'expire' || duel.verdict === null) return fr.duel.expireTitre
  if (duel.verdict === 'invite') return fr.duel.gagne
  if (duel.verdict === 'inviteur') return fr.duel.perdu
  return fr.duel.egalite
}
