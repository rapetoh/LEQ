import { describe, expect, it } from 'vitest'

import { lireMessageEntrant } from './protocole.js'
import { avancer, avancerTout, etatInitial, type EvenementSession } from './session.js'

// The rules of chapter 10 that are easy to get wrong and impossible to test through a socket:
// what the cap counts, who pays for a cut, and what a finished session ignores.

const OUVERTURE: EvenementSession = {
  type: 'session_ouverte',
  entree: { debatId: 'd1', dureeMaxS: 180, secondesParlees: 0, tours: [] },
}

function ouverte(secondesParlees = 0, dureeMaxS = 180, tours = []) {
  return avancer(etatInitial(), {
    type: 'session_ouverte',
    entree: { debatId: 'd1', dureeMaxS, secondesParlees, tours },
  }).etat
}

describe('opening a session', () => {
  it('starts listening, with the cap and the time already spoken', () => {
    const etat = ouverte(0, 180)
    expect(etat.phase).toBe('ecoute')
    expect(etat.dureeMaxS).toBe(180)
    expect(etat.dernierTour).toBe(0)
  })

  it('picks up a resumed session where it stopped, not at zero', () => {
    const etat = avancer(etatInitial(), {
      type: 'session_ouverte',
      entree: {
        debatId: 'd1',
        dureeMaxS: 180,
        secondesParlees: 62.5,
        tours: [
          { numero: 1, locuteur: 'utilisateur', texte: 'a' },
          { numero: 2, locuteur: 'retor', texte: 'b' },
        ],
      },
    }).etat
    expect(etat.secondesParlees).toBe(62.5)
    expect(etat.dernierTour).toBe(2)
  })
})

describe('a turn', () => {
  it('writes what the person said before anything else, so a resume never loses it', () => {
    const decision = avancer(ouverte(), {
      type: 'tour_utilisateur',
      texte: 'Je pense que non.',
      dureeS: 12,
    })
    expect(decision.ecrire).toEqual({
      numero: 1,
      locuteur: 'utilisateur',
      texte: 'Je pense que non.',
      dureeS: 12,
    })
    expect(decision.etat.phase).toBe('reflexion')
  })

  it('tells the app how much time is left', () => {
    const decision = avancer(ouverte(0, 180), { type: 'tour_utilisateur', texte: 'a', dureeS: 12 })
    expect(decision.envoyer[0]).toEqual({
      type: 'temps',
      secondes_parlees: 12,
      secondes_restantes: 168,
    })
  })

  it('numbers the turns in one sequence across both speakers', () => {
    const { etat, decisions } = avancerTout(ouverte(), [
      { type: 'tour_utilisateur', texte: 'a', dureeS: 10 },
      { type: 'tour_retor', texte: 'b' },
      { type: 'tour_utilisateur', texte: 'c', dureeS: 10 },
    ])
    expect(decisions.map((d) => d.ecrire?.numero)).toEqual([1, 2, 3])
    expect(etat.dernierTour).toBe(3)
  })

  it('sends the answer as text, before any voice has been made', () => {
    const apres = avancer(ouverte(), { type: 'tour_utilisateur', texte: 'a', dureeS: 10 }).etat
    const decision = avancer(apres, { type: 'tour_retor', texte: 'Vous confondez deux choses.' })
    expect(decision.envoyer).toEqual([
      { type: 'reponse_texte', numero: 2, texte: 'Vous confondez deux choses.' },
    ])
    expect(decision.etat.phase).toBe('ecoute')
  })

  it('ignores a second turn while Rétor is still answering', () => {
    const apres = avancer(ouverte(), { type: 'tour_utilisateur', texte: 'a', dureeS: 10 }).etat
    const decision = avancer(apres, { type: 'tour_utilisateur', texte: 'b', dureeS: 10 })
    expect(decision.ecrire).toBeNull()
    expect(decision.etat.secondesParlees).toBe(10)
  })
})

describe('the cap', () => {
  it('counts only what the person said, never what Rétor said', () => {
    const { etat } = avancerTout(ouverte(0, 180), [
      { type: 'tour_utilisateur', texte: 'a', dureeS: 30 },
      { type: 'tour_retor', texte: 'une longue réponse' },
      { type: 'tour_utilisateur', texte: 'c', dureeS: 30 },
    ])
    expect(etat.secondesParlees).toBe(60)
  })

  it('ends the session when the cap is reached, and still writes the last turn', () => {
    const decision = avancer(ouverte(170, 180), {
      type: 'tour_utilisateur',
      texte: 'a',
      dureeS: 15,
    })
    expect(decision.ecrire?.texte).toBe('a')
    expect(decision.cloturer).toBe('terminee')
    expect(decision.envoyer.at(-1)).toEqual({ type: 'termine', raison: 'plafond' })
  })

  it('lets Rétor answer while there is time left', () => {
    const decision = avancer(ouverte(100, 180), {
      type: 'tour_utilisateur',
      texte: 'a',
      dureeS: 15,
    })
    expect(decision.cloturer).toBeNull()
    expect(decision.etat.phase).toBe('reflexion')
  })

  it('never reports a negative time left', () => {
    const decision = avancer(ouverte(175, 180), {
      type: 'tour_utilisateur',
      texte: 'a',
      dureeS: 30,
    })
    const temps = decision.envoyer.find((m) => m.type === 'temps')
    expect(temps).toMatchObject({ secondes_restantes: 0 })
  })
})

describe('who pays for a cut', () => {
  it('charges nothing when the cut is ours, and says it can be resumed', () => {
    const decision = avancer(ouverte(), { type: 'coupure' })
    expect(decision.cloturer).toBe('interrompue_par_nous')
    expect(decision.envoyer).toEqual([{ type: 'interrompu', reprise_possible: true }])
  })

  it('charges the session when the person ends it themselves', () => {
    const decision = avancer(ouverte(), { type: 'utilisateur_termine' })
    expect(decision.cloturer).toBe('terminee')
    expect(decision.envoyer).toEqual([{ type: 'termine', raison: 'utilisateur' }])
  })

  it('charges nothing twice: a socket closing after the end changes nothing', () => {
    const finie = avancer(ouverte(), { type: 'utilisateur_termine' }).etat
    const apres = avancer(finie, { type: 'coupure' })
    expect(apres.cloturer).toBeNull()
    expect(apres.etat.issue).toBe('terminee')
  })

  it('ignores a turn that arrives after the end', () => {
    const finie = avancer(ouverte(), { type: 'coupure' }).etat
    const apres = avancer(finie, { type: 'tour_utilisateur', texte: 'a', dureeS: 10 })
    expect(apres.ecrire).toBeNull()
    expect(apres.envoyer).toEqual([])
  })
})

describe('reading a frame off the socket', () => {
  it('accepts the messages the app sends', () => {
    expect(lireMessageEntrant('{"type":"bonjour","jeton":"j","debat_id":"d"}')).toEqual({
      type: 'bonjour',
      jeton: 'j',
      debat_id: 'd',
    })
    expect(lireMessageEntrant('{"type":"fin_tour"}')).toEqual({ type: 'fin_tour' })
    expect(lireMessageEntrant('{"type":"audio","donnees":"AAA"}')).toEqual({
      type: 'audio',
      donnees: 'AAA',
    })
  })

  it('keeps the turn number of a resume when the app sends one', () => {
    expect(
      lireMessageEntrant('{"type":"bonjour","jeton":"j","debat_id":"d","depuis_tour":4}'),
    ).toEqual({
      type: 'bonjour',
      jeton: 'j',
      debat_id: 'd',
      depuis_tour: 4,
    })
  })

  it('refuses anything else, because a socket is an open door', () => {
    expect(lireMessageEntrant('pas du json')).toBeNull()
    expect(lireMessageEntrant('null')).toBeNull()
    expect(lireMessageEntrant('{"type":"inconnu"}')).toBeNull()
    expect(lireMessageEntrant('{"type":"bonjour"}')).toBeNull()
    expect(lireMessageEntrant('{"type":"bonjour","jeton":"","debat_id":"d"}')).toBeNull()
    expect(lireMessageEntrant('{"type":"audio"}')).toBeNull()
    expect(lireMessageEntrant('{"type":"bonjour","jeton":1,"debat_id":"d"}')).toBeNull()
  })
})

describe('the whole shape of a session', () => {
  it('runs from the first word to the debrief without a wasted state', () => {
    const { etat, decisions } = avancerTout(etatInitial(), [
      OUVERTURE,
      { type: 'tour_utilisateur', texte: 'Le télétravail isole.', dureeS: 20 },
      { type: 'tour_retor', texte: 'Isole de quoi, exactement ?' },
      { type: 'tour_utilisateur', texte: 'Des échanges informels.', dureeS: 25 },
      { type: 'tour_retor', texte: 'Ceux que personne ne regrette ?' },
      { type: 'utilisateur_termine' },
    ])
    expect(etat.phase).toBe('terminee')
    expect(etat.issue).toBe('terminee')
    expect(etat.secondesParlees).toBe(45)
    expect(decisions.filter((d) => d.ecrire !== null)).toHaveLength(4)
    expect(decisions.filter((d) => d.cloturer !== null)).toHaveLength(1)
  })
})
