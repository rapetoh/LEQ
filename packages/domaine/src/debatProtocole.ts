/**
 * The wire between the app and the server during a face-à-face (cahier chapter 10). It lives
 * here because it is a contract between two workspaces: `apps/serveur` speaks it, `apps/mobile`
 * listens to it, and neither may drift from the other.
 *
 * The hard part of this feature is not the arguing, it is the waiting: past a few seconds of
 * silence the exchange is dead. So the protocol is built to let the app show something at every
 * stage instead of a spinner. The text of the answer is sent as soon as it exists, before the
 * voice that says it, and the transcription is sent while the person is still speaking.
 *
 * The hard part of this feature is not the arguing, it is the waiting: past a few seconds of
 * silence the exchange is dead. So the protocol is built to let the app show something at every
 * stage instead of a spinner. The text of the answer is sent as soon as it exists, before the
 * voice that says it, and the transcription is sent while the person is still speaking.
 */

export const VERSION_PROTOCOLE = 1

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

export interface MessageAudio {
  type: 'audio'
  /** One chunk of microphone PCM or Opus, base64. */
  donnees: string
}

/** The person stopped talking. The server also detects this itself; whichever comes first wins. */
export interface MessageFinTour {
  type: 'fin_tour'
}

export interface MessageTerminer {
  type: 'terminer'
}

export type MessageEntrant = MessageBonjour | MessageAudio | MessageFinTour | MessageTerminer

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
}

/** What the server hears, as it hears it. `partiel` means it may still change. */
export interface MessageTranscription {
  type: 'transcription'
  texte: string
  partiel: boolean
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
  'protocole',
  'interne',
] as const
export type CodeErreurDebat = (typeof CODES_ERREUR_DEBAT)[number]

/** Sentences the app shows when it has none of its own. French, plain, no blame on the person. */
export const MESSAGES_ERREUR_DEBAT: Readonly<Record<CodeErreurDebat, string>> = {
  jeton_invalide: 'Ta session a expiré. Ouvre LEQ à nouveau.',
  debat_introuvable: 'Ce débat est introuvable.',
  debat_clos: 'Ce débat est terminé.',
  protocole: "Ça n'a pas marché. C'est nous, pas toi.",
  interne: "Ça n'a pas marché. C'est nous, pas toi.",
}
