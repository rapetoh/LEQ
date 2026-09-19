/**
 * Reading what arrives on the socket. The message shapes themselves are the contract, in
 * @leq/domaine; this file is the server's door policy for them.
 */
import type { MessageBonjour, MessageEntrant } from '@leq/domaine'

export type {
  CodeErreurDebat,
  MessageAudio,
  MessageBonjour,
  MessageEntrant,
  MessageErreur,
  MessageFinTour,
  MessageAToi,
  MessageARetor,
  MessageInterrompu,
  MessageMonTour,
  MessageParole,
  MessagePret,
  MessageReprendreParole,
  MessageReponseAudio,
  MessageReponseTexte,
  MessageSortant,
  MessageTemps,
  MessageTermine,
  MessageTerminer,
  MessageTranscription,
  RaisonFin,
  RaisonFinTour,
  TourPublie,
} from '@leq/domaine'
export { CODES_ERREUR_DEBAT, MESSAGES_ERREUR_DEBAT, VERSION_PROTOCOLE } from '@leq/domaine'

// --------------------------------------------------------------------------------------------
// Parsing what arrives on the socket
// --------------------------------------------------------------------------------------------

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === 'object' && valeur !== null
}

/**
 * Reads one incoming frame. Answers null for anything that is not a message we know, because a
 * socket is an open door and everything that arrives on it is a stranger's word.
 */
export function lireMessageEntrant(brut: string): MessageEntrant | null {
  let valeur: unknown
  try {
    valeur = JSON.parse(brut)
  } catch {
    return null
  }
  if (!estObjet(valeur)) return null
  switch (valeur['type']) {
    case 'bonjour': {
      const jeton = valeur['jeton']
      const debatId = valeur['debat_id']
      if (typeof jeton !== 'string' || jeton === '') return null
      if (typeof debatId !== 'string' || debatId === '') return null
      const depuis = valeur['depuis_tour']
      const message: MessageBonjour = { type: 'bonjour', jeton, debat_id: debatId }
      if (typeof depuis === 'number' && Number.isInteger(depuis) && depuis >= 0) {
        message.depuis_tour = depuis
      }
      return message
    }
    case 'audio': {
      const donnees = valeur['donnees']
      return typeof donnees === 'string' ? { type: 'audio', donnees } : null
    }
    case 'fin_tour': {
      const raison = valeur['raison']
      return raison === 'micro' || raison === 'bouton'
        ? { type: 'fin_tour', raison }
        : { type: 'fin_tour' }
    }
    case 'reprendre_parole':
      return { type: 'reprendre_parole' }
    case 'terminer':
      return { type: 'terminer' }
    default:
      return null
  }
}
