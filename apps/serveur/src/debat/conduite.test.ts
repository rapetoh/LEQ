import { describe, expect, it, vi } from 'vitest'
import { pino } from 'pino'

import { Conduite, type Canal, type DebatOuvert, type DepotDebat } from './conduite.js'
import { AdversaireStub, TranscripteurFluxStub, VoixStub } from './fournisseurs.js'
import type { MessageSortant } from './protocole.js'

// A whole debate, end to end, with no socket, no database and no provider key. What is checked
// is the order of operations: a turn is written before it is answered, and a cut is ours.

const log = pino({ level: 'silent' })

const DEBAT: DebatOuvert = {
  id: 'd1',
  these_texte: 'Le télétravail a tué la vie de bureau.',
  ton_adversaire: 'ferme',
  duree_max_s: 180,
  secondes_parlees: 0,
  statut: 'ouverte',
}

function monter(debat: Partial<DebatOuvert> = {}, uid: string | null = 'u1') {
  const envoyes: MessageSortant[] = []
  const ecrits: Array<{ numero: number; locuteur: string; texte: string }> = []
  const clotures: string[] = []
  const debriefs: string[] = []
  let ferme = false
  let repriseAilleurs = false

  const canal: Canal = {
    envoyer: (message) => envoyes.push(message),
    fermer: () => {
      ferme = true
    },
  }
  const depot: DepotDebat = {
    utilisateurDuJeton: async () => uid,
    lireDebat: async () => ({ ...DEBAT, ...debat }),
    lireTours: async () => [],
    prendreSession: async () => 's1',
    ecrireTour: async (_id, numero, locuteur, texte) => {
      if (repriseAilleurs) throw Object.assign(new Error('session_perdue'), { code: '55006' })
      ecrits.push({ numero, locuteur, texte })
    },
    cloturer: async (_id, issue) => {
      clotures.push(issue)
    },
    reprendre: async () => ({ ...DEBAT, ...debat, statut: 'ouverte' }),
    demanderDebrief: async (id) => {
      debriefs.push(id)
    },
  }
  const conduite = new Conduite(
    {
      depot,
      transcripteur: new TranscripteurFluxStub(),
      adversaire: new AdversaireStub(),
      voix: new VoixStub(),
      log,
    },
    canal,
  )
  return {
    conduite,
    envoyes,
    ecrits,
    clotures,
    debriefs,
    estFerme: () => ferme,
    reprendreAilleurs: () => {
      repriseAilleurs = true
    },
  }
}

const BONJOUR = JSON.stringify({ type: 'bonjour', jeton: 'j', debat_id: 'd1' })

describe('opening the connection', () => {
  it('hands the app the session it needs to draw the screen', async () => {
    const { conduite, envoyes } = monter()
    await conduite.recevoir(BONJOUR)
    expect(envoyes[0]).toMatchObject({
      type: 'pret',
      debat_id: 'd1',
      these: 'Le télétravail a tué la vie de bureau.',
      duree_max_s: 180,
    })
  })

  it('refuses a token it cannot resolve, and says so in French', async () => {
    const { conduite, envoyes, estFerme } = monter({}, null)
    await conduite.recevoir(BONJOUR)
    expect(envoyes[0]).toMatchObject({ type: 'erreur', code: 'jeton_invalide' })
    expect(envoyes[0]).toMatchObject({ message: 'Ta session a expiré. Ouvre LEQ à nouveau.' })
    expect(estFerme()).toBe(true)
  })

  it('refuses a debate that is already over', async () => {
    const { conduite, envoyes } = monter({ statut: 'terminee' })
    await conduite.recevoir(BONJOUR)
    expect(envoyes[0]).toMatchObject({ type: 'erreur', code: 'debat_clos' })
  })

  it('refuses a frame that is not a message we know', async () => {
    const { conduite, envoyes } = monter()
    await conduite.recevoir('{"type":"audio","donnees":"AA"}'.replace('audio', 'inconnu'))
    expect(envoyes[0]).toMatchObject({ type: 'erreur', code: 'protocole' })
  })
})

describe('a turn', () => {
  async function unTour() {
    const monte = monter()
    await monte.conduite.recevoir(BONJOUR)
    await monte.conduite.recevoir(JSON.stringify({ type: 'audio', donnees: 'AAAA' }))
    await monte.conduite.recevoir(JSON.stringify({ type: 'fin_tour' }))
    return monte
  }

  it('writes what the person said, then what Rétor answered, in that order', async () => {
    const { ecrits } = await unTour()
    expect(ecrits).toEqual([
      { numero: 1, locuteur: 'utilisateur', texte: 'Tour transcrit de 1 morceau.' },
      {
        numero: 2,
        locuteur: 'retor',
        texte: 'Contre-argument 1 sur « Le télétravail a tué la vie de bureau. », ton ferme.',
      },
    ])
  })

  it('sends the transcription while the person speaks, then the answer as text', async () => {
    const { envoyes } = await unTour()
    const types = envoyes.map((m) => m.type)
    expect(types).toContain('transcription')
    expect(types.indexOf('reponse_texte')).toBeLessThan(types.indexOf('reponse_audio'))
  })

  it('closes the voice stream even when nothing was said', async () => {
    const { envoyes } = await unTour()
    const dernier = envoyes.filter((m) => m.type === 'reponse_audio').at(-1)
    expect(dernier).toMatchObject({ fin: true })
  })

  it('answers what was really just said, not a script', async () => {
    const { envoyes } = await unTour()
    const reponse = envoyes.find((m) => m.type === 'reponse_texte')
    expect(reponse).toMatchObject({ texte: expect.stringContaining('Le télétravail') })
  })
})

describe('ending a debate', () => {
  it('charges the session and asks for the debrief when the person ends it', async () => {
    const { conduite, clotures, debriefs, estFerme } = monter()
    await conduite.recevoir(BONJOUR)
    await conduite.recevoir(JSON.stringify({ type: 'terminer' }))
    expect(clotures).toEqual(['terminee'])
    expect(debriefs).toEqual(['d1'])
    expect(estFerme()).toBe(true)
  })

  it('charges nothing and asks for no debrief when the socket drops mid-debate', async () => {
    const { conduite, clotures, debriefs, envoyes } = monter()
    await conduite.recevoir(BONJOUR)
    await conduite.surFermeture()
    expect(clotures).toEqual(['interrompue_par_nous'])
    expect(debriefs).toEqual([])
    expect(envoyes.at(-1)).toMatchObject({ type: 'interrompu', reprise_possible: true })
  })

  it('does nothing when the socket drops after the debate already ended', async () => {
    const { conduite, clotures } = monter()
    await conduite.recevoir(BONJOUR)
    await conduite.recevoir(JSON.stringify({ type: 'terminer' }))
    await conduite.surFermeture()
    expect(clotures).toEqual(['terminee'])
  })

  it('does nothing when a socket drops before anyone was identified', async () => {
    const { conduite, clotures } = monter()
    await conduite.surFermeture()
    expect(clotures).toEqual([])
  })

  it('ends the session at the cap, without asking Rétor to answer into a closed debate', async () => {
    // The cap is already spent when the session opens, so the first turn reaches it whatever
    // the wall clock does during the test.
    const { conduite, envoyes, ecrits, clotures } = monter({ duree_max_s: 1, secondes_parlees: 1 })
    await conduite.recevoir(BONJOUR)
    await conduite.recevoir(JSON.stringify({ type: 'audio', donnees: 'AAAA' }))
    await conduite.recevoir(JSON.stringify({ type: 'fin_tour' }))
    expect(ecrits.map((e) => e.locuteur)).toEqual(['utilisateur'])
    expect(envoyes.at(-1)).toMatchObject({ type: 'termine', raison: 'plafond' })
    expect(clotures).toEqual(['terminee'])
  })
})

describe('when something breaks on our side', () => {
  it('ends the session as our own cut rather than charging the person', async () => {
    const monte = monter()
    await monte.conduite.recevoir(BONJOUR)
    const adversaire = new AdversaireStub()
    vi.spyOn(adversaire, 'repondre').mockRejectedValue(new Error('fournisseur indisponible'))
    const conduite = new Conduite(
      {
        depot: {
          utilisateurDuJeton: async () => 'u1',
          lireDebat: async () => DEBAT,
          lireTours: async () => [],
          prendreSession: async () => 's1',
          ecrireTour: async () => undefined,
          cloturer: async (_id, issue) => {
            monte.clotures.push(issue)
          },
          reprendre: async () => DEBAT,
          demanderDebrief: async () => undefined,
        },
        transcripteur: new TranscripteurFluxStub(),
        adversaire,
        voix: new VoixStub(),
        log,
      },
      { envoyer: (m) => monte.envoyes.push(m), fermer: () => undefined },
    )
    await conduite.recevoir(BONJOUR)
    await conduite.recevoir(JSON.stringify({ type: 'audio', donnees: 'AAAA' }))
    await conduite.recevoir(JSON.stringify({ type: 'fin_tour' }))
    await conduite.surFermeture()
    expect(monte.clotures).toContain('interrompue_par_nous')
  })
})

// E3b offered a "Reprendre" button for months that always answered "ce débat est terminé": our
// own cut closed the row, and every resume path required it to be open.
describe('reprendre après notre propre coupure', () => {
  it('rouvre la session et rend ses tours', async () => {
    const envoyes: MessageSortant[] = []
    let reprises = 0
    const conduite = new Conduite(
      {
        depot: {
          utilisateurDuJeton: async () => 'u1',
          lireDebat: async () => ({ ...DEBAT, statut: 'interrompue' }),
          lireTours: async () => [{ numero: 1, locuteur: 'utilisateur', texte: 'déjà dit' }],
          prendreSession: async () => 's1',
          ecrireTour: async () => undefined,
          cloturer: async () => undefined,
          reprendre: async () => {
            reprises += 1
            return { ...DEBAT, statut: 'ouverte', secondes_parlees: 20 }
          },
          demanderDebrief: async () => undefined,
        },
        transcripteur: new TranscripteurFluxStub(),
        adversaire: new AdversaireStub(),
        voix: new VoixStub(),
        log,
      },
      { envoyer: (m) => envoyes.push(m), fermer: () => undefined },
    )
    await conduite.recevoir(BONJOUR)
    expect(reprises).toBe(1)
    expect(envoyes[0]).toMatchObject({
      type: 'pret',
      secondes_parlees: 20,
      tours: [{ numero: 1, texte: 'déjà dit' }],
    })
  })

  it("refuse une session qui s'est vraiment terminée", async () => {
    const envoyes: MessageSortant[] = []
    const conduite = new Conduite(
      {
        depot: {
          utilisateurDuJeton: async () => 'u1',
          lireDebat: async () => ({ ...DEBAT, statut: 'terminee' }),
          lireTours: async () => [],
          prendreSession: async () => 's1',
          ecrireTour: async () => undefined,
          cloturer: async () => undefined,
          reprendre: async () => null,
          demanderDebrief: async () => undefined,
        },
        transcripteur: new TranscripteurFluxStub(),
        adversaire: new AdversaireStub(),
        voix: new VoixStub(),
        log,
      },
      { envoyer: (m) => envoyes.push(m), fermer: () => undefined },
    )
    await conduite.recevoir(BONJOUR)
    expect(envoyes[0]).toMatchObject({ type: 'erreur', code: 'debat_clos' })
  })
})

// Two sockets held the same debate when a phone reconnected before the old one was collected,
// and the loser's writes replaced the live turns while its close ended a session someone was
// still speaking into.
describe('quand une autre connexion reprend le débat', () => {
  it("n'écrit plus rien et laisse la session vivante", async () => {
    const monte = monter()
    await monte.conduite.recevoir(BONJOUR)
    monte.reprendreAilleurs()
    await monte.conduite.recevoir(JSON.stringify({ type: 'fin_tour' }))
    await monte.conduite.attendre()
    await monte.conduite.surFermeture()
    expect(monte.ecrits).toEqual([])
    expect(monte.clotures).toEqual([])
    expect(monte.envoyes.at(-1)).toMatchObject({ type: 'erreur', code: 'autre_appareil' })
    expect(monte.estFerme()).toBe(true)
  })

  it('refuse la connexion quand le débat ne peut plus être pris', async () => {
    const envoyes: MessageSortant[] = []
    const conduite = new Conduite(
      {
        depot: {
          utilisateurDuJeton: async () => 'u1',
          lireDebat: async () => DEBAT,
          lireTours: async () => [],
          prendreSession: async () => null,
          ecrireTour: async () => undefined,
          cloturer: async () => undefined,
          reprendre: async () => null,
          demanderDebrief: async () => undefined,
        },
        transcripteur: new TranscripteurFluxStub(),
        adversaire: new AdversaireStub(),
        voix: new VoixStub(),
        log,
      },
      { envoyer: (m) => envoyes.push(m), fermer: () => undefined },
    )
    await conduite.recevoir(BONJOUR)
    expect(envoyes[0]).toMatchObject({ type: 'erreur', code: 'debat_clos' })
  })
})

// A provider that never answers used to leave the session open with a person watching a silent
// screen, holding a slot of the month until the socket died on its own.
describe('quand un fournisseur ne répond jamais', () => {
  it("coupe de notre côté au lieu d'attendre indéfiniment", async () => {
    const envoyes: MessageSortant[] = []
    const clotures: string[] = []
    const adversaire = new AdversaireStub()
    vi.spyOn(adversaire, 'repondre').mockReturnValue(new Promise(() => undefined))
    const conduite = new Conduite(
      {
        depot: {
          utilisateurDuJeton: async () => 'u1',
          lireDebat: async () => DEBAT,
          lireTours: async () => [],
          prendreSession: async () => 's1',
          ecrireTour: async () => undefined,
          cloturer: async (_id, issue) => {
            clotures.push(issue)
          },
          reprendre: async () => null,
          demanderDebrief: async () => undefined,
        },
        transcripteur: new TranscripteurFluxStub(),
        adversaire,
        voix: new VoixStub(),
        log,
        delais: { adversaireMs: 5, morceauVoixMs: 5, finDeTourMs: 5 },
      },
      { envoyer: (m) => envoyes.push(m), fermer: () => undefined },
    )
    await conduite.recevoir(BONJOUR)
    await conduite.recevoir(JSON.stringify({ type: 'fin_tour' }))
    await conduite.attendre()
    expect(envoyes.some((m) => m.type === 'erreur' && m.code === 'interne')).toBe(true)
    expect(clotures).toEqual(['interrompue_par_nous'])
  })
})
