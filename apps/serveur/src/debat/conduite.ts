/**
 * Conducts one face-à-face: the socket on one side, the session rules and the providers on the
 * other. Everything it needs is injected, so a whole debate can be run in a test with no socket,
 * no database and no provider key.
 *
 * Two things are the point of this file.
 *
 * The order of operations: a turn is written before it is answered, because a machine that dies
 * between the two must lose the connection and not the debate. Anything that goes wrong on our
 * side ends the session as our own cut, which the month ignores.
 *
 * And **who holds the floor**, which is decided here and nowhere else. The transcription
 * provider used to decide it, by committing a sentence after 700 ms of silence: Rétor answered
 * people who were drawing breath, and what they said next went into a turn that no longer
 * existed. A pause is not the end of a turn. The floor passes when the person says so, or after
 * a silence long enough to mean they have finished, and either way the app is told
 * (`a_toi`, `a_retor`) so the screen can never disagree with the server.
 */
import type { IssueDebat } from '@leq/domaine'

import type { Logger } from '../log.js'
import { CompteurConsommation, type ConsommationDebat } from './consommation.js'
import type {
  Adversaire,
  TranscripteurFlux,
  Voix,
  FluxTranscription,
  TourTranscrit,
} from './fournisseurs.js'
import {
  MESSAGES_ERREUR_DEBAT,
  VERSION_PROTOCOLE,
  lireMessageEntrant,
  type CodeErreurDebat,
  type MessageEntrant,
  type MessageSortant,
  type RaisonFinTour,
  type TourPublie,
} from './protocole.js'
import {
  avancer,
  etatInitial,
  type DecisionSession,
  type EtatSession,
  type PhaseSession,
} from './session.js'

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
  /** Rebecca's value for the silence that passes the floor; the default stands in when absent. */
  silence_fin_tour_ms?: number
}

export interface DepotDebat {
  /** The signed-in user behind an access token, or null. The server never trusts a sent id. */
  utilisateurDuJeton(jeton: string): Promise<string | null>
  lireDebat(debatId: string, utilisateurId: string): Promise<DebatOuvert | null>
  lireTours(debatId: string): Promise<TourPublie[]>
  /**
   * Claims the debate for this connection and answers the identifier its writes must carry.
   * Null when the debate is no longer open. The newest connection wins: a socket left behind by
   * a reconnection stops being able to write, instead of overwriting the live turns.
   */
  prendreSession(debatId: string): Promise<string | null>
  ecrireTour(
    debatId: string,
    numero: number,
    locuteur: 'utilisateur' | 'retor',
    texte: string,
    dureeS: number | null,
    session: string | null,
  ): Promise<void>
  cloturer(
    debatId: string,
    issue: IssueDebat,
    session: string | null,
    consommation: ConsommationDebat | null,
  ): Promise<void>
  /** Reopens a session our own cut closed, when the person comes back inside the window. */
  reprendre(debatId: string): Promise<DebatOuvert | null>
  /** Queues the debrief, which reads the written transcript (chapter 10). */
  demanderDebrief(debatId: string): Promise<void>
}

/**
 * How long a provider may take before the session gives up on it. Nothing is waited on for ever:
 * a debate that hangs is a person holding a phone in silence, and the session would sit open,
 * holding its slot, until the socket eventually died.
 */
export interface DelaisConduite {
  /** Rétor's answer, from the end of the turn to the first word back. */
  adversaireMs: number
  /** One chunk of spoken audio. A voice that stalls degrades the turn, it does not end it. */
  morceauVoixMs: number
  /** The final transcript of a turn, once the floor has passed. */
  finDeTourMs: number
}

export const DELAIS_CONDUITE: DelaisConduite = {
  adversaireMs: 30_000,
  morceauVoixMs: 15_000,
  finDeTourMs: 20_000,
}

/**
 * How long a silence lasts before the floor passes on its own, when the person has not said
 * they are finished. Two seconds and change: long enough to think, to breathe and to look for
 * the next word, short enough that a debate stays a debate. The app draws the countdown from
 * the same number, so the silence is visible before it costs the floor, and one word takes it
 * back. Rebecca can move it (`silence_fin_tour_debat_ms`).
 */
export const SILENCE_FIN_TOUR_MS = 2_200

/**
 * How quiet a frame has to be to count as silence, on the Int16 scale the phone sends. Speech
 * through a phone's voice processing sits in the thousands; a quiet room sits under two hundred.
 * The floor of the threshold is raised by the room itself, so a noisy café does not hold the
 * floor for ever.
 */
const SEUIL_PAROLE_RMS = 350

/**
 * How long the room has to stay quiet before the silence is announced. Shorter than this and
 * every gap between two words would start a countdown on the person's screen.
 */
const SILENCE_ANNONCE_MS = 400

export interface DependancesConduite {
  depot: DepotDebat
  transcripteur: TranscripteurFlux
  adversaire: Adversaire
  voix: Voix
  log: Logger
  delais?: DelaisConduite
}

export class Conduite {
  private etat: EtatSession = etatInitial()
  private flux: FluxTranscription | null = null
  private debat: DebatOuvert | null = null
  private tours: TourPublie[] = []
  /**
   * Bytes of audio received for the current turn. The cap is the person's speaking time, and
   * the provider's voice detection says how much of the turn was speech; when a provider
   * cannot say, the audio received stands in for it. Neither is measured with a clock on the
   * server: the first transcript of a turn used to start it, and with a provider that
   * transcribes only once the person has stopped, a session counted seven seconds for four
   * minutes of speech and its cap never came.
   */
  private octetsDuTour = 0
  /**
   * Who may speak now. The session's phase says what the machine is busy with; this says whose
   * voice counts, and it is the only thing the audio frames are judged against.
   */
  private parole: 'personne' | 'retor' = 'retor'
  /** True once a word has been heard in this turn: an opening silence passes no floor. */
  private aParle = false
  /** Whether the last frames carried a voice, as this server hears them. */
  private enParole = false
  /** When the last frame with a voice in it arrived. */
  private dernierMotMs = 0
  /** The room's own level, so a noisy place does not read as someone speaking. */
  private bruitDeFond = 120
  /** The silence that ends a turn, counting down. A word stops it, the button beats it. */
  private minuteurSilence: ReturnType<typeof setTimeout> | null = null
  /** Set when the person takes the floor back: Rétor's voice stops where it is. */
  private repriseDemandee = false
  /** How long a silence lasts before it passes the floor, for this session. */
  private silenceMs = SILENCE_FIN_TOUR_MS
  /** Set while a turn is being flushed, so two `fin_tour` frames cannot flush it twice. */
  private finDeTourEnCours = false
  /** The identifier this connection writes with, from the moment it claimed the debate. */
  private session: string | null = null
  /** Set when another connection took the debate over. This one then touches nothing more. */
  private cede = false
  private traitement: Promise<void> = Promise.resolve()
  /** What the providers consumed for this session, written with the close. */
  private readonly consommation = new CompteurConsommation()

  private readonly delais: DelaisConduite

  constructor(
    private readonly deps: DependancesConduite,
    private readonly canal: Canal,
  ) {
    this.delais = deps.delais ?? DELAIS_CONDUITE
  }

  /**
   * Frames are handled one at a time, in order: a debate is a conversation, not a race. Two
   * things do not queue.
   *
   * Cutting in, because the queue is busy saying the very answer the person is interrupting,
   * and a barge-in that waits for it to finish is not a barge-in.
   *
   * And the floor a frame of audio arrived under, because the queue may only reach it after the
   * floor has come back: what was said while Rétor was speaking would then be transcribed into
   * the next turn, as if the person had said it to him.
   */
  recevoir(brut: string): Promise<void> {
    const message = lireMessageEntrant(brut)
    if (!message) {
      this.refuser('protocole')
      return Promise.resolve()
    }
    if (message.type === 'reprendre_parole') {
      this.reprendreLaParole()
      return Promise.resolve()
    }
    // The floor moves when the person says it moves, not when the queue gets round to it: what
    // they say in that interval belongs to nobody, and the app has already stopped sending.
    if (message.type === 'fin_tour') {
      if (!this.passerLaParole(message.raison ?? 'bouton')) return Promise.resolve()
      this.enfiler(() => this.fermerLeTour())
      return this.attendre()
    }
    const parole = this.parole
    this.enfiler(() => this.traiter(message, parole))
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

  private async traiter(
    message: MessageEntrant,
    paroleALArrivee: 'personne' | 'retor',
  ): Promise<void> {
    switch (message.type) {
      case 'bonjour':
        return this.ouvrir(message.jeton, message.debat_id)
      case 'audio': {
        // Only what is said while the floor is the person's belongs to their turn. A microphone
        // left open while Rétor speaks is not an argument, and it used to be transcribed into
        // the next one.
        if (paroleALArrivee !== 'personne' || this.parole !== 'personne') return
        if (this.etat.phase !== 'ecoute' || !this.flux) return
        const octets = decoderBase64(message.donnees)
        this.octetsDuTour += octets.byteLength
        this.ecouterLaSalle(octets)
        this.flux.ecrire(octets)
        return
      }
      case 'fin_tour':
        // Handled on arrival, never here: the floor cannot wait behind a queue.
        return
      case 'reprendre_parole':
        // Handled on arrival, never here: it must not wait behind Rétor's own voice.
        return
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

    // From here the debate is ours, and no longer whoever held it before.
    this.session = await this.deps.depot.prendreSession(debatId)
    if (!this.session) return this.refuser('debat_clos')

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
    this.silenceMs =
      typeof debat.silence_fin_tour_ms === 'number' && debat.silence_fin_tour_ms > 0
        ? debat.silence_fin_tour_ms
        : SILENCE_FIN_TOUR_MS
    this.canal.envoyer({
      type: 'pret',
      version: VERSION_PROTOCOLE,
      debat_id: debat.id,
      these: debat.these_texte,
      ton: debat.ton_adversaire,
      duree_max_s: debat.duree_max_s,
      secondes_parlees: debat.secondes_parlees,
      tours: this.tours,
      silence_fin_tour_ms: this.silenceMs,
      provisoire: this.surStubs(),
    })
    this.ouvrirFlux()
    this.donnerLaParole()
  }

  /** A debate run on stubs is readable, but it is not a debate. The screen must say which. */
  private surStubs(): boolean {
    return [this.deps.transcripteur.nom, this.deps.adversaire.nom, this.deps.voix.nom].includes(
      'stub',
    )
  }

  private ouvrirFlux(): void {
    this.octetsDuTour = 0
    this.flux = this.deps.transcripteur.ouvrir({
      langue: 'fr',
      surSegment: (segment) => {
        this.canal.envoyer({
          type: 'transcription',
          texte: segment.texte,
          partiel: !segment.definitif,
        })
      },
      surConsommation: (partie) => this.consommation.transcription(partie),
    })
  }

  /**
   * Hears the room itself, frame by frame, and decides whether anyone is speaking.
   *
   * The transcription provider has its own detector and it cannot be relied on: after a turn
   * the person ended with the button, it stays silent and announces neither the next word nor
   * the next silence (seen on 2026-09-13, and again on 2026-09-19 when a whole second turn
   * never passed the floor). The audio is already here, so the server listens to it.
   */
  private ecouterLaSalle(octets: Uint8Array): void {
    if (this.cede || this.parole !== 'personne' || this.etat.phase !== 'ecoute') return
    const niveau = rmsInt16(octets)
    const seuil = Math.max(SEUIL_PAROLE_RMS, this.bruitDeFond * 3)
    const instant = Date.now()
    if (niveau >= seuil) {
      this.dernierMotMs = instant
      this.aParle = true
      if (this.enParole) return
      this.enParole = true
      this.arreterLeSilence()
      this.canal.envoyer({ type: 'parole', actif: true })
      return
    }
    // A quiet frame: the room's own level follows it, slowly, so the threshold sits above the
    // noise of wherever the person is.
    this.bruitDeFond = this.bruitDeFond * 0.95 + niveau * 0.05
    if (!this.aParle || !this.enParole) return
    const quiet = instant - this.dernierMotMs
    if (quiet < SILENCE_ANNONCE_MS) return
    this.enParole = false
    const restant = Math.max(0, this.silenceMs - quiet)
    this.canal.envoyer({ type: 'parole', actif: false, restant_ms: restant })
    this.arreterLeSilence()
    this.minuteurSilence = setTimeout(() => {
      this.minuteurSilence = null
      if (!this.passerLaParole('silence')) return
      this.enfiler(() => this.fermerLeTour())
    }, restant)
    this.minuteurSilence.unref?.()
  }

  /**
   * Reads the phase through a call, because the compiler keeps the narrowing of a property
   * across an await and cannot see that applying a decision replaced the whole state.
   */
  private phaseEst(phase: PhaseSession): boolean {
    return this.etat.phase === phase
  }

  private arreterLeSilence(): void {
    if (!this.minuteurSilence) return
    clearTimeout(this.minuteurSilence)
    this.minuteurSilence = null
  }

  /** Hands the floor to the person and says so: the screen changes on this message alone. */
  private donnerLaParole(): void {
    if (this.cede || this.etat.phase === 'terminee') return
    this.arreterLeSilence()
    this.parole = 'personne'
    this.aParle = false
    this.enParole = false
    this.dernierMotMs = 0
    this.octetsDuTour = 0
    this.canal.envoyer({ type: 'a_toi' })
  }

  /**
   * Takes the floor from the person, at the instant the reason to do so arrives: they said they
   * had finished, the silence ran out, or their microphone went. Announced before anything else,
   * because the phone stops sending on this message.
   */
  private passerLaParole(raison: RaisonFinTour): boolean {
    if (this.cede || this.finDeTourEnCours) return false
    if (this.parole !== 'personne' || this.etat.phase !== 'ecoute' || !this.flux) return false
    this.finDeTourEnCours = true
    this.arreterLeSilence()
    // A new turn for Rétor: whatever cut the previous one short is spent. The flag is not
    // cleared when the floor comes back, because the voice loop is still unwinding then.
    this.repriseDemandee = false
    this.parole = 'retor'
    this.canal.envoyer({ type: 'a_retor', raison })
    return true
  }

  /** Closes the transcript of the turn that just ended, and has Rétor answer it. */
  private async fermerLeTour(): Promise<void> {
    if (!this.flux) {
      this.finDeTourEnCours = false
      return
    }
    let tour: TourTranscrit
    try {
      tour = await avecDelai(this.flux.terminer(), this.delais.finDeTourMs, 'fin de tour')
    } finally {
      this.finDeTourEnCours = false
    }
    this.octetsDuTour = 0
    // A turn with nothing said in it is not a turn: a door, a cough, a microphone in a pocket.
    // The floor comes straight back rather than having Rétor answer a silence.
    if (tour.texte.trim() === '') return this.donnerLaParole()
    await this.tourDeLUtilisateur(tour.texte, Math.max(0, tour.dureeS))
  }

  /**
   * The person cuts in while Rétor is speaking. His voice stops where it is, as a person's
   * would, and the floor is theirs again. What he had already said stays in the transcript: he
   * did say it, and the debrief reads the whole exchange.
   */
  private reprendreLaParole(): void {
    if (this.cede || this.etat.phase === 'terminee' || this.parole !== 'retor') return
    this.repriseDemandee = true
    // While he is still being written (phase « reflexion ») the floor comes back with his text,
    // a second later, rather than leaving two turns being written at once.
    if (this.etat.phase === 'ecoute') this.donnerLaParole()
  }

  private async tourDeLUtilisateur(texte: string, dureeS: number): Promise<void> {
    await this.appliquer(avancer(this.etat, { type: 'tour_utilisateur', texte, dureeS }))
    if (this.cede || this.etat.phase !== 'reflexion' || !this.debat) return

    const reponse = await avecDelai(
      this.deps.adversaire.repondre({
        these: this.debat.these_texte,
        ton: this.debat.ton_adversaire,
        tours: this.tours,
        surConsommation: (partie) => this.consommation.texte(partie),
      }),
      this.delais.adversaireMs,
      'reponse de Retor',
    )
    await this.appliquer(avancer(this.etat, { type: 'tour_retor', texte: reponse }))
    await this.direAVoixHaute(this.etat.dernierTour, reponse)
    this.octetsDuTour = 0
    // Back to the person, and said out loud. A screen that has to guess this is a screen that
    // tells someone to speak into a microphone nobody is listening to.
    // Unless the person already took it back mid-sentence: then it is theirs and saying so
    // twice would restart their turn under them.
    if (!this.cede && this.parole === 'retor' && this.phaseEst('ecoute')) this.donnerLaParole()
  }

  private async direAVoixHaute(numero: number, texte: string): Promise<void> {
    try {
      for await (const morceau of parMorceau(
        this.deps.voix.dire(texte, (partie) => this.consommation.voix(partie)),
        this.delais.morceauVoixMs,
        'voix',
      )) {
        // Cut in on: the rest of the sentence is not sent, and the loop's own `return` closes
        // the provider's stream so nothing keeps being paid for.
        if (this.repriseDemandee || this.cede) break
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
    if (this.cede) return
    this.etat = decision.etat
    if (decision.ecrire) {
      const { numero, locuteur, texte, dureeS } = decision.ecrire
      try {
        await this.deps.depot.ecrireTour(
          this.etat.debatId ?? '',
          numero,
          locuteur,
          texte,
          dureeS,
          this.session,
        )
      } catch (erreur) {
        if (estSessionPerdue(erreur)) return this.ceder()
        throw erreur
      }
      this.tours = [...this.tours, { numero, locuteur, texte }]
      // What the person said, as it was written down. Rétor's turns went to the screen and
      // theirs did not, so the exchange read as one voice answering nobody.
      if (locuteur === 'utilisateur') this.canal.envoyer({ type: 'mon_tour', numero, texte })
    }
    for (const message of decision.envoyer) this.canal.envoyer(message)
    if (decision.cloturer) await this.terminer(decision.cloturer)
  }

  private async terminer(issue: IssueDebat): Promise<void> {
    const debatId = this.etat.debatId
    this.arreterLeSilence()
    this.flux?.fermer()
    this.flux = null
    if (!debatId) return this.canal.fermer()
    try {
      await this.deps.depot.cloturer(debatId, issue, this.session, this.consommation.lire())
      if (issue === 'terminee') await this.deps.depot.demanderDebrief(debatId)
    } catch (erreur) {
      this.deps.log.error({ err: erreur, debat_id: debatId }, 'debat: cloture impossible')
    }
    this.canal.fermer()
  }

  /**
   * Another connection took the debate over. This one stops where it stands: it writes nothing
   * more, and above all it does not close a session someone else is speaking into.
   */
  private ceder(): void {
    this.cede = true
    this.arreterLeSilence()
    this.flux?.fermer()
    this.flux = null
    this.deps.log.warn({ debat_id: this.etat.debatId }, 'debat: session reprise ailleurs')
    this.canal.envoyer({
      type: 'erreur',
      code: 'autre_appareil',
      message: MESSAGES_ERREUR_DEBAT.autre_appareil,
    })
    this.canal.fermer()
  }

  /** The socket went away. If the debate was still running, the cut is ours. */
  async surFermeture(): Promise<void> {
    await this.attendre()
    if (this.cede) return
    if (this.etat.phase === 'terminee' || this.etat.phase === 'connexion') {
      this.flux?.fermer()
      return
    }
    await this.appliquer(avancer(this.etat, { type: 'coupure' }))
  }

  private async abandonnerSurErreur(): Promise<void> {
    if (this.cede || this.etat.phase === 'terminee') return
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

/** Waits for a provider, but not for ever. */
async function avecDelai<T>(travail: Promise<T>, ms: number, quoi: string): Promise<T> {
  let minuteur: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      travail,
      new Promise<never>((_resoudre, rejeter) => {
        minuteur = setTimeout(() => rejeter(new Error(`${quoi} : rien en ${ms} ms`)), ms)
      }),
    ])
  } finally {
    if (minuteur) clearTimeout(minuteur)
  }
}

/** The same, chunk by chunk: a stream that stops arriving is a stream that has stopped. */
async function* parMorceau<T>(
  source: AsyncIterable<T>,
  ms: number,
  quoi: string,
): AsyncIterable<T> {
  const iterateur = source[Symbol.asyncIterator]()
  try {
    for (;;) {
      const suivant = await avecDelai(iterateur.next(), ms, quoi)
      if (suivant.done) return
      yield suivant.value
    }
  } finally {
    await iterateur.return?.().catch(() => undefined)
  }
}

/** Postgres says 55006, object_in_use: another connection holds this debate now. */
function estSessionPerdue(erreur: unknown): boolean {
  return (
    typeof erreur === 'object' && erreur !== null && (erreur as { code?: unknown }).code === '55006'
  )
}

/** The level of one frame of 16-bit little-endian mono PCM, on its own scale. */
function rmsInt16(octets: Uint8Array): number {
  const echantillons = Math.floor(octets.byteLength / 2)
  if (echantillons === 0) return 0
  let somme = 0
  for (let i = 0; i < echantillons; i += 1) {
    const brut = octets[i * 2]! | (octets[i * 2 + 1]! << 8)
    const valeur = brut > 32_767 ? brut - 65_536 : brut
    somme += valeur * valeur
  }
  return Math.sqrt(somme / echantillons)
}

function decoderBase64(donnees: string): Uint8Array {
  return new Uint8Array(Buffer.from(donnees, 'base64'))
}

function encoderBase64(octets: Uint8Array): string {
  return Buffer.from(octets).toString('base64')
}
