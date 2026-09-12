/**
 * Conducts one face-à-face: the socket on one side, the session rules and the providers on the
 * other. Everything it needs is injected, so a whole debate can be run in a test with no socket,
 * no database and no provider key.
 *
 * The order of operations is the point of this file. A turn is written before it is answered,
 * because a machine that dies between the two must lose the connection and not the debate. And
 * anything that goes wrong on our side ends the session as our own cut, which the month ignores.
 */
import type { IssueDebat } from '@leq/domaine'

import type { Logger } from '../log.js'
import type { Adversaire, TranscripteurFlux, Voix, FluxTranscription } from './fournisseurs.js'
import {
  MESSAGES_ERREUR_DEBAT,
  VERSION_PROTOCOLE,
  lireMessageEntrant,
  type CodeErreurDebat,
  type MessageSortant,
  type TourPublie,
} from './protocole.js'
import { avancer, etatInitial, type DecisionSession, type EtatSession } from './session.js'

/** What the conductor writes to. A WebSocket in production, an array in a test. */
export interface Canal {
  envoyer(message: MessageSortant): void
  fermer(): void
}

export interface DebatOuvert {
  id: string
  these_texte: string
  ton_adversaire: string
  duree_max_s: number
  secondes_parlees: number
  statut: string
}

export interface DepotDebat {
  /** The signed-in user behind an access token, or null. The server never trusts a sent id. */
  utilisateurDuJeton(jeton: string): Promise<string | null>
  lireDebat(debatId: string, utilisateurId: string): Promise<DebatOuvert | null>
  lireTours(debatId: string): Promise<TourPublie[]>
  ecrireTour(
    debatId: string,
    numero: number,
    locuteur: 'utilisateur' | 'retor',
    texte: string,
    dureeS: number | null,
  ): Promise<void>
  cloturer(debatId: string, issue: IssueDebat): Promise<void>
  /** Reopens a session our own cut closed, when the person comes back inside the window. */
  reprendre(debatId: string): Promise<DebatOuvert | null>
  /** Queues the debrief, which reads the written transcript (chapter 10). */
  demanderDebrief(debatId: string): Promise<void>
}

export interface DependancesConduite {
  depot: DepotDebat
  transcripteur: TranscripteurFlux
  adversaire: Adversaire
  voix: Voix
  log: Logger
}

export class Conduite {
  private etat: EtatSession = etatInitial()
  private flux: FluxTranscription | null = null
  private debat: DebatOuvert | null = null
  private tours: TourPublie[] = []
  /**
   * When audio actually started arriving for the current turn, not when the turn became
   * possible. The cap is the person's speaking time: charging them for reading the thesis, for
   * thinking, or for listening to Rétor would end a three-minute session after forty seconds of
   * speech.
   */
  private debutParole: number | null = null
  /** Set while a turn is being flushed, so two `fin_tour` frames cannot flush it twice. */
  private finDeTourEnCours = false
  private traitement: Promise<void> = Promise.resolve()

  constructor(
    private readonly deps: DependancesConduite,
    private readonly canal: Canal,
  ) {}

  /** Frames are handled one at a time, in order: a debate is a conversation, not a race. */
  recevoir(brut: string): Promise<void> {
    this.enfiler(() => this.traiter(brut))
    return this.attendre()
  }

  private enfiler(travail: () => Promise<void>): void {
    this.traitement = this.traitement.then(travail).catch((erreur: unknown) => {
      this.deps.log.error({ err: erreur }, 'debat: traitement en echec')
      return this.abandonnerSurErreur()
    })
  }

  /**
   * Waits for the queue to drain, including work queued while it was draining. A turn queues
   * the answer to itself, so awaiting only the first link would return before Rétor spoke.
   */
  async attendre(): Promise<void> {
    let precedent: Promise<void> | null = null
    while (precedent !== this.traitement) {
      precedent = this.traitement
      await precedent.catch(() => undefined)
    }
  }

  private async traiter(brut: string): Promise<void> {
    const message = lireMessageEntrant(brut)
    if (!message) return this.refuser('protocole')

    switch (message.type) {
      case 'bonjour':
        return this.ouvrir(message.jeton, message.debat_id)
      case 'audio': {
        if (this.etat.phase !== 'ecoute' || !this.flux) return
        this.flux.ecrire(decoderBase64(message.donnees))
        return
      }
      case 'fin_tour': {
        // The screen sends this on the button and again on an audio interruption, so the two
        // can arrive together. Without the flag the second flush writes a duplicate turn, or an
        // empty one that Rétor then answers and the debrief reads.
        if (this.etat.phase !== 'ecoute' || !this.flux || this.finDeTourEnCours) return
        this.finDeTourEnCours = true
        try {
          await this.flux.terminer()
        } finally {
          this.finDeTourEnCours = false
        }
        return
      }
      case 'terminer':
        return this.appliquer(avancer(this.etat, { type: 'utilisateur_termine' }))
    }
  }

  private async ouvrir(jeton: string, debatId: string): Promise<void> {
    if (this.etat.phase !== 'connexion') return this.refuser('protocole')
    const utilisateurId = await this.deps.depot.utilisateurDuJeton(jeton)
    if (!utilisateurId) return this.refuser('jeton_invalide')

    let debat = await this.deps.depot.lireDebat(debatId, utilisateurId)
    if (!debat) return this.refuser('debat_introuvable')
    // Coming back after our own cut is the case the per-turn writes exist for. Only a session
    // that really ended stays closed.
    if (debat.statut === 'interrompue') {
      debat = (await this.deps.depot.reprendre(debatId)) ?? debat
    }
    if (debat.statut !== 'ouverte') return this.refuser('debat_clos')

    this.debat = debat
    this.tours = await this.deps.depot.lireTours(debatId)
    const decision = avancer(this.etat, {
      type: 'session_ouverte',
      entree: {
        debatId: debat.id,
        dureeMaxS: debat.duree_max_s,
        secondesParlees: debat.secondes_parlees,
        tours: this.tours,
      },
    })
    this.etat = decision.etat
    this.canal.envoyer({
      type: 'pret',
      version: VERSION_PROTOCOLE,
      debat_id: debat.id,
      these: debat.these_texte,
      ton: debat.ton_adversaire,
      duree_max_s: debat.duree_max_s,
      secondes_parlees: debat.secondes_parlees,
      tours: this.tours,
    })
    this.ouvrirFlux()
  }

  private ouvrirFlux(): void {
    this.debutParole = null
    this.flux = this.deps.transcripteur.ouvrir({
      langue: 'fr',
      surSegment: (segment) => {
        // The first segment of a turn is the first moment we know the person is speaking.
        this.debutParole ??= Date.now()
        this.canal.envoyer({
          type: 'transcription',
          texte: segment.texte,
          partiel: !segment.definitif,
        })
      },
      surFinDeTour: (texte) => {
        // A turn where nothing was ever heard costs nothing.
        const dureeS = this.debutParole === null ? 0 : (Date.now() - this.debutParole) / 1000
        this.debutParole = null
        this.enfiler(() => this.tourDeLUtilisateur(texte, Math.max(0, dureeS)))
      },
    })
  }

  private async tourDeLUtilisateur(texte: string, dureeS: number): Promise<void> {
    await this.appliquer(avancer(this.etat, { type: 'tour_utilisateur', texte, dureeS }))
    if (this.etat.phase !== 'reflexion' || !this.debat) return

    const reponse = await this.deps.adversaire.repondre({
      these: this.debat.these_texte,
      ton: this.debat.ton_adversaire,
      tours: this.tours,
    })
    await this.appliquer(avancer(this.etat, { type: 'tour_retor', texte: reponse }))
    await this.direAVoixHaute(this.etat.dernierTour, reponse)
    this.debutParole = null
  }

  private async direAVoixHaute(numero: number, texte: string): Promise<void> {
    try {
      for await (const morceau of this.deps.voix.dire(texte)) {
        this.canal.envoyer({
          type: 'reponse_audio',
          numero,
          donnees: encoderBase64(morceau),
          fin: false,
        })
      }
    } catch (erreur) {
      // The text is already on screen; a voice that fails is a degraded turn, not a dead debate.
      this.deps.log.warn({ err: erreur }, 'debat: voix indisponible sur ce tour')
    }
    this.canal.envoyer({ type: 'reponse_audio', numero, donnees: '', fin: true })
  }

  /** Writes what the session decided, then says it. Never the other way round. */
  private async appliquer(decision: DecisionSession): Promise<void> {
    this.etat = decision.etat
    if (decision.ecrire) {
      const { numero, locuteur, texte, dureeS } = decision.ecrire
      await this.deps.depot.ecrireTour(this.etat.debatId ?? '', numero, locuteur, texte, dureeS)
      this.tours = [...this.tours, { numero, locuteur, texte }]
    }
    for (const message of decision.envoyer) this.canal.envoyer(message)
    if (decision.cloturer) await this.terminer(decision.cloturer)
  }

  private async terminer(issue: IssueDebat): Promise<void> {
    const debatId = this.etat.debatId
    this.flux?.fermer()
    this.flux = null
    if (!debatId) return this.canal.fermer()
    try {
      await this.deps.depot.cloturer(debatId, issue)
      if (issue === 'terminee') await this.deps.depot.demanderDebrief(debatId)
    } catch (erreur) {
      this.deps.log.error({ err: erreur, debat_id: debatId }, 'debat: cloture impossible')
    }
    this.canal.fermer()
  }

  /** The socket went away. If the debate was still running, the cut is ours. */
  async surFermeture(): Promise<void> {
    await this.attendre()
    if (this.etat.phase === 'terminee' || this.etat.phase === 'connexion') {
      this.flux?.fermer()
      return
    }
    await this.appliquer(avancer(this.etat, { type: 'coupure' }))
  }

  private async abandonnerSurErreur(): Promise<void> {
    if (this.etat.phase === 'terminee') return
    this.canal.envoyer({
      type: 'erreur',
      code: 'interne',
      message: MESSAGES_ERREUR_DEBAT.interne,
    })
    if (this.etat.phase === 'connexion') return this.canal.fermer()
    await this.appliquer(avancer(this.etat, { type: 'coupure' }))
  }

  private refuser(code: CodeErreurDebat): void {
    this.canal.envoyer({ type: 'erreur', code, message: MESSAGES_ERREUR_DEBAT[code] })
    this.canal.fermer()
  }
}

function decoderBase64(donnees: string): Uint8Array {
  return new Uint8Array(Buffer.from(donnees, 'base64'))
}

function encoderBase64(octets: Uint8Array): string {
  return Buffer.from(octets).toString('base64')
}
