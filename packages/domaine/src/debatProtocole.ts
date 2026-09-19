/**
 * The wire between the app and the server during a face-à-face (cahier chapter 10). It lives
 * here because it is a contract between two workspaces: `apps/serveur` speaks it, `apps/mobile`
 * listens to it, and neither may drift from the other.
 *
 * The hard part of this feature is not the arguing, it is the waiting: past a few seconds of
 * silence the exchange is dead. So the text of the answer is sent as soon as it exists, before
 * the voice that says it, and the transcription is sent while the person is still speaking.
 *
 * **Who holds the floor is said out loud, in one message, and the server is the only one who
 * decides it** (version 2). Version 1 had two deciders and no announcement: the transcription
 * provider ended a turn after 700 ms of silence, and the app was never told. A person pausing to
 * think was answered mid-argument, everything they said next went into a turn the server had
 * already closed, and the screen still read « À toi de parler ». So the floor now moves on
 * `a_toi` and `a_retor` and on nothing else; the app draws what those two say. A silence long
 * enough to pass the floor is announced before it passes (`parole`), so the person sees it
 * coming and can keep the floor by speaking.
 */

export const VERSION_PROTOCOLE = 2

// --------------------------------------------------------------------------------------------
// App to server
// --------------------------------------------------------------------------------------------

/** First message of the connection: who is speaking, and about which session. */
export interface MessageBonjour {
  type: 'bonjour'
  /** Supabase access token. The server never trusts a user id sent by a client. */
  jeton: string
  debat_id: string
  /** Turn number the app already has, so a resume sends back only what it is missing. */
  depuis_tour?: number
}

/**
 * Why a turn ended: the silence ran out, the person said so, the microphone went, or their
 * speaking time for the session did.
 */
export type RaisonFinTour = 'silence' | 'bouton' | 'micro' | 'plafond'

export interface MessageAudio {
  type: 'audio'
  /** One chunk of microphone PCM or Opus, base64. */
  donnees: string
}

/** The person says they have finished: the floor passes now, without waiting for the silence. */
export interface MessageFinTour {
  type: 'fin_tour'
  /** Why. A microphone taken by a call ends the turn too, and the screen says which it was. */
  raison?: RaisonFinTour
}

/** The person takes the floor back while Rétor is speaking. His voice stops where it is. */
export interface MessageReprendreParole {
  type: 'reprendre_parole'
}

export interface MessageTerminer {
  type: 'terminer'
}

export type MessageEntrant =
  MessageBonjour | MessageAudio | MessageFinTour | MessageReprendreParole | MessageTerminer

// --------------------------------------------------------------------------------------------
// Server to app
// --------------------------------------------------------------------------------------------

export interface TourPublie {
  numero: number
  locuteur: 'utilisateur' | 'retor'
  texte: string
}

/** The session, as the app needs it to draw E3 (and to redraw it after a resume). */
export interface MessagePret {
  type: 'pret'
  version: number
  debat_id: string
  these: string
  ton: string
  duree_max_s: number
  secondes_parlees: number
  /** Everything said so far. Empty on a fresh session, the whole debate on a resume. */
  tours: TourPublie[]
  /**
   * How long a silence lasts before the floor passes to Rétor, in milliseconds. The app draws
   * the countdown with this number, so the person watches the same clock as the server.
   */
  silence_fin_tour_ms: number
  /**
   * True while the server runs on stubs: the transcription counts chunks and Rétor answers with
   * a placeholder. The screen has to say so, because a stubbed transcript looks exactly like a
   * broken one.
   */
  provisoire: boolean
}

/** What the server hears, as it hears it. `partiel` means it may still change. */
export interface MessageTranscription {
  type: 'transcription'
  /** The whole turn so far, pauses included, not only the piece being said. */
  texte: string
  partiel: boolean
}

/**
 * The server hears speech, or hears silence. The app cancels or starts its countdown on it:
 * the silence that passes the floor is visible from its first second.
 */
export interface MessageParole {
  type: 'parole'
  actif: boolean
  /** With `actif: false`, how long the floor still has to run. The app draws that countdown. */
  restant_ms?: number
}

/** The floor is the person's: Rétor has finished, or they took it back. */
export interface MessageAToi {
  type: 'a_toi'
}

/** The floor is Rétor's. Nothing the microphone captures from here is part of the turn. */
export interface MessageARetor {
  type: 'a_retor'
  raison: RaisonFinTour
}

/**
 * The person's own turn, as it was written down. The app showed their words only while they
 * were being said and then dropped them, so the thread was Rétor talking to himself.
 */
export interface MessageMonTour {
  type: 'mon_tour'
  numero: number
  texte: string
}

/** Rétor's answer as text, sent before the voice so the app can show it at once. */
export interface MessageReponseTexte {
  type: 'reponse_texte'
  numero: number
  texte: string
}

export interface MessageReponseAudio {
  type: 'reponse_audio'
  numero: number
  donnees: string
  fin: boolean
}

export interface MessageTemps {
  type: 'temps'
  secondes_parlees: number
  secondes_restantes: number
}

export type RaisonFin = 'plafond' | 'utilisateur'

export interface MessageTermine {
  type: 'termine'
  raison: RaisonFin
}

/** A cut on our side. The app says it can be resumed, and the month is not charged. */
export interface MessageInterrompu {
  type: 'interrompu'
  reprise_possible: boolean
}

export interface MessageErreur {
  type: 'erreur'
  code: CodeErreurDebat
  message: string
}

export type MessageSortant =
  | MessagePret
  | MessageTranscription
  | MessageParole
  | MessageAToi
  | MessageARetor
  | MessageMonTour
  | MessageReponseTexte
  | MessageReponseAudio
  | MessageTemps
  | MessageTermine
  | MessageInterrompu
  | MessageErreur

export const CODES_ERREUR_DEBAT = [
  'jeton_invalide',
  'debat_introuvable',
  'debat_clos',
  'autre_appareil',
  'protocole',
  'interne',
] as const
export type CodeErreurDebat = (typeof CODES_ERREUR_DEBAT)[number]

/** Sentences the app shows when it has none of its own. French, plain, no blame on the person. */
export const MESSAGES_ERREUR_DEBAT: Readonly<Record<CodeErreurDebat, string>> = {
  jeton_invalide: 'Ta session a expiré. Ouvre LEQ à nouveau.',
  debat_introuvable: 'Ce débat est introuvable.',
  debat_clos: 'Ce débat est terminé.',
  autre_appareil: 'Ce face-à-face continue sur un autre appareil.',
  protocole: "Ça n'a pas marché. L'erreur vient de chez nous.",
  interne: "Ça n'a pas marché. L'erreur vient de chez nous.",
}
