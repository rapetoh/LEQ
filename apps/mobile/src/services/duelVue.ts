// What a duel row says, computed once and tested: the other person's name, the line under the
// subject in the list, and whether the home should point at this duel. No React, no network.
import { issueDuel, type DuelVue } from '@leq/domaine'

import { t } from '@/i18n/fr'

import { texteReste } from './delai'

/** The other person's first name, or the neutral word when the profile carries none. */
export function nomAdversaire(duel: Pick<DuelVue, 'adversaire'>): string {
  return duel.adversaire?.prenom?.trim() || t('duel.adversaireSansNom')
}

export type BadgeDuel = 'termine' | 'expire' | null

/** The end of a duel is a state, so it is worn as a badge and not written into the status line. */
export function badgeDuel(duel: Pick<DuelVue, 'statut'>): BadgeDuel {
  if (duel.statut === 'clos') return 'termine'
  if (duel.statut === 'expire') return 'expire'
  return null
}

/** The status line of a duel in the list, with what is left of the 48 h while it is open. */
export function ligneEtat(duel: DuelVue, maintenant: Date = new Date()): string {
  const nom = nomAdversaire(duel)
  // A finished duel wears its badge; the line under it says the outcome, never « Terminé » again.
  if (duel.statut === 'expire') return t('duel.ligne.expire')
  if (duel.statut === 'clos') {
    switch (issueDuel(duel)) {
      case 'gagne':
        return t('duel.ligne.gagne')
      case 'perdu':
        return t('duel.ligne.perdu', { nom })
      case 'egalite':
        return t('duel.ligne.egalite')
      case 'sans_verdict':
        return t('duel.ligne.sansVerdict')
      default:
        return t('duel.ligne.verdictPret')
    }
  }
  const reste = texteReste(duel.echeance, maintenant)
  const etat = !duel.adversaire
    ? t('duel.ligne.invitationAEnvoyer')
    : duel.moi.a_parle
      ? t('duel.ligne.attente', { nom })
      : duel.lui.a_parle
        ? t('duel.ligne.aRepondu', { nom })
        : t('duel.ligne.aToiDeParler')
  return `${etat} · ${reste}`
}

export type AttentionDuel = 'a_toi' | 'verdict' | null

/**
 * Whether the home points at this duel: it is the person's turn and someone is on the other
 * side, or a verdict fell within the last two days.
 */
export function attentionDuel(duel: DuelVue, maintenant: Date = new Date()): AttentionDuel {
  if (duel.statut === 'ouvert') {
    return duel.adversaire && !duel.moi.a_parle ? 'a_toi' : null
  }
  if (duel.statut === 'clos' && duel.clos_le) {
    const age = maintenant.getTime() - Date.parse(duel.clos_le)
    return age >= 0 && age < 48 * 3_600_000 ? 'verdict' : null
  }
  return null
}

/** The duel the home shows first: a turn to take before a verdict to read, newest first. */
export function duelAMettreEnAvant(
  duels: readonly DuelVue[],
  maintenant: Date = new Date(),
): { duel: DuelVue; attention: Exclude<AttentionDuel, null> } | null {
  let verdict: DuelVue | null = null
  for (const duel of duels) {
    const attention = attentionDuel(duel, maintenant)
    if (attention === 'a_toi') return { duel, attention }
    if (attention === 'verdict' && !verdict) verdict = duel
  }
  return verdict ? { duel: verdict, attention: 'verdict' } : null
}
