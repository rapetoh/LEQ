/**
 * The rules of one face-à-face session, as a pure state machine (cahier chapter 10).
 *
 * No socket, no database, no provider: events in, decisions out. That is deliberate. The
 * awkward parts of this feature are the cap, the resume and who pays for a cut, and those are
 * exactly the parts that are impossible to test through a WebSocket.
 */
import type { IssueDebat } from '@leq/domaine'

import type { MessageSortant, RaisonFin, TourPublie } from './protocole.js'

export type PhaseSession =
  /** Waiting for the first frame: nobody is identified yet. */
  | 'connexion'
  /** Identified, the person may speak. */
  | 'ecoute'
  /** The person stopped; Rétor is being written and said. */
  | 'reflexion'
  | 'terminee'

export interface EtatSession {
  phase: PhaseSession
  debatId: string | null
  dureeMaxS: number
  secondesParlees: number
  /** Number of the last turn written, whoever said it. */
  dernierTour: number
  issue: IssueDebat | null
}

export interface EntreeSession {
  debatId: string
  dureeMaxS: number
  secondesParlees: number
  tours: TourPublie[]
}

export function etatInitial(): EtatSession {
  return {
    phase: 'connexion',
    debatId: null,
    dureeMaxS: 0,
    secondesParlees: 0,
    dernierTour: 0,
    issue: null,
  }
}

/** Everything that can happen to a session, from either side of the wire. */
export type EvenementSession =
  | { type: 'session_ouverte'; entree: EntreeSession }
  /** The person finished speaking: what they said, and for how long. */
  | { type: 'tour_utilisateur'; texte: string; dureeS: number }
  /** Rétor answered. */
  | { type: 'tour_retor'; texte: string }
  | { type: 'utilisateur_termine' }
  /** The connection dropped, or a provider failed: our side, our cost. */
  | { type: 'coupure' }

/** What the session decides: what to send, what to write, whether it is over. */
export interface DecisionSession {
  etat: EtatSession
  envoyer: MessageSortant[]
  /** A turn to persist before anything else, so a resume never loses it. */
  ecrire: {
    numero: number
    locuteur: 'utilisateur' | 'retor'
    texte: string
    dureeS: number | null
  } | null
  /** Set once, when the session is over: how it ends, and whether it costs a slot. */
  cloturer: IssueDebat | null
}

function secondesRestantes(etat: EtatSession): number {
  return Math.max(0, Math.round((etat.dureeMaxS - etat.secondesParlees) * 100) / 100)
}

function fin(etat: EtatSession, raison: RaisonFin, issue: IssueDebat): DecisionSession {
  return {
    etat: { ...etat, phase: 'terminee', issue },
    envoyer: [{ type: 'termine', raison }],
    ecrire: null,
    cloturer: issue,
  }
}

/**
 * One step of the session.
 *
 * Three rules of chapter 10 are here and nowhere else. The cap counts only what the person
 * said, never what Rétor said, because the cap is about their practice. A cut on our side ends
 * the session as `interrompue_par_nous`, which the quota ignores. And a session already over
 * ignores everything that arrives late, so a socket closing after the end never rewrites it.
 */
export function avancer(etat: EtatSession, evenement: EvenementSession): DecisionSession {
  const rien: DecisionSession = { etat, envoyer: [], ecrire: null, cloturer: null }
  if (etat.phase === 'terminee') return rien

  switch (evenement.type) {
    case 'session_ouverte': {
      const { entree } = evenement
      const suivant: EtatSession = {
        phase: 'ecoute',
        debatId: entree.debatId,
        dureeMaxS: entree.dureeMaxS,
        secondesParlees: entree.secondesParlees,
        dernierTour: entree.tours.reduce((max, tour) => Math.max(max, tour.numero), 0),
        issue: null,
      }
      return { etat: suivant, envoyer: [], ecrire: null, cloturer: null }
    }

    case 'tour_utilisateur': {
      if (etat.phase !== 'ecoute') return rien
      const secondes = Math.max(0, evenement.dureeS)
      const parlees = Math.round((etat.secondesParlees + secondes) * 100) / 100
      const numero = etat.dernierTour + 1
      const suivant: EtatSession = {
        ...etat,
        phase: 'reflexion',
        secondesParlees: parlees,
        dernierTour: numero,
      }
      const decision: DecisionSession = {
        etat: suivant,
        envoyer: [
          {
            type: 'temps',
            secondes_parlees: parlees,
            secondes_restantes: secondesRestantes(suivant),
          },
        ],
        ecrire: {
          numero,
          locuteur: 'utilisateur',
          texte: evenement.texte,
          dureeS: secondes,
        },
        cloturer: null,
      }
      // The cap is reached: the turn is still written, and Rétor does not answer into a
      // session that is over.
      if (parlees >= suivant.dureeMaxS) {
        const arret = fin(suivant, 'plafond', 'terminee')
        return {
          ...arret,
          envoyer: [...decision.envoyer, ...arret.envoyer],
          ecrire: decision.ecrire,
        }
      }
      return decision
    }

    case 'tour_retor': {
      if (etat.phase !== 'reflexion') return rien
      const numero = etat.dernierTour + 1
      return {
        etat: { ...etat, phase: 'ecoute', dernierTour: numero },
        envoyer: [{ type: 'reponse_texte', numero, texte: evenement.texte }],
        ecrire: { numero, locuteur: 'retor', texte: evenement.texte, dureeS: null },
        cloturer: null,
      }
    }

    case 'utilisateur_termine':
      return fin(etat, 'utilisateur', 'terminee')

    case 'coupure':
      // Our side broke. The session stays resumable and the month is not charged.
      return {
        etat: { ...etat, phase: 'terminee', issue: 'interrompue_par_nous' },
        envoyer: [{ type: 'interrompu', reprise_possible: true }],
        ecrire: null,
        cloturer: 'interrompue_par_nous',
      }
  }
}

/** Runs a whole list of events, for tests and for replaying a resume. */
export function avancerTout(
  etat: EtatSession,
  evenements: readonly EvenementSession[],
): { etat: EtatSession; decisions: DecisionSession[] } {
  let courant = etat
  const decisions: DecisionSession[] = []
  for (const evenement of evenements) {
    const decision = avancer(courant, evenement)
    courant = decision.etat
    decisions.push(decision)
  }
  return { etat: courant, decisions }
}
