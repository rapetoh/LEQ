/**
 * Speech-to-text boundary. Two modes:
 * - batch (`Transcripteur`): one file in, one timed transcript out; used for attempts.
 * - streaming (`TranscripteurFlux`): PCM chunks in, partial and final word events out;
 *   used by the debate (Phase 8). Interface only, no implementation yet.
 *
 * The real providers (Deepgram, Gladia, OpenAI, AssemblyAI) live in `bench/src/adaptateurs`
 * until the Phase 2 bench picks one; the server then hosts the chosen adapter.
 */
import { creerAlea } from './alea.js'
import type { Transcription, MotTranscrit } from './domaine.js'
import { lireEnteteWav } from './wav.js'

export interface OptionsTranscription {
  /** MIME type of the bytes, e.g. `audio/mp4`, `audio/wav`. */
  mime: string
  /** Only French is supported by the product. */
  langue: 'fr'
}

export interface Transcripteur {
  /** Provider name written into `analyses.fournisseur_transcription` (`'stub'` for the fake). */
  readonly fournisseur: string
  transcrireFichier(audio: Uint8Array, options: OptionsTranscription): Promise<Transcription>
}

/* ----------------------------- streaming mode ----------------------------- */

/**
 * Events emitted by a streaming session, in order of arrival.
 * - `mot_partiel`: a hypothesis that may still change; the UI may show it greyed out.
 * - `mot_final`: a word that will not change; the only kind that feeds the measures.
 * - `fin_de_tour`: the provider's endpointing decided the speaker stopped (silence);
 *   the debate loop uses it to hand the turn to Rétor.
 * - `erreur`: the session is broken; `fatale` says whether it can be reopened.
 * - `fin`: emitted once after `fermer()` when every final word has been delivered.
 */
export type EvenementFlux =
  | { type: 'mot_partiel'; mot: string; debut_s: number; fin_s: number | null }
  | { type: 'mot_final'; mot: MotTranscrit }
  | { type: 'fin_de_tour'; instant_s: number }
  | { type: 'erreur'; message: string; fatale: boolean }
  | { type: 'fin' }

export interface OptionsFlux {
  langue: 'fr'
  /** Sample rate of the PCM chunks sent with `envoyer`. */
  frequence_hz: number
  /** `pcm_s16le` is what the phone streams; providers accept it natively. */
  encodage: 'pcm_s16le'
  /** Silence length after which the provider emits `fin_de_tour`, when it supports it. */
  fin_de_tour_ms?: number
}

export interface SessionFlux {
  /** Pushes raw little-endian 16-bit PCM. Never blocks; back-pressure is the provider's job. */
  envoyer(pcm: Uint8Array): void
  /** Signals end of audio; the provider flushes remaining finals then emits `fin`. */
  fermer(): Promise<void>
  /** Consumed by one reader: `for await (const evenement of session.evenements)`. */
  readonly evenements: AsyncIterable<EvenementFlux>
}

export interface TranscripteurFlux {
  readonly fournisseur: string
  ouvrir(options: OptionsFlux): Promise<SessionFlux>
}

/* --------------------------------- stub ---------------------------------- */

export interface OptionsTranscripteurStub {
  /** Seed of the fake, so two runs on the same input give the same transcript. */
  graine?: number
  /** Target speaking rate of the fake speaker. */
  mots_par_minute?: number
  /** Forces the duration, whatever the bytes contain. */
  duree_s?: number
  /** Assumed bitrate for compressed input (AAC in `.m4a`), used to estimate the duration. */
  debit_kbps?: number
}

const PHRASES_STUB: readonly string[] = [
  'Bonjour à toutes et à tous, merci d’être là ce matin.',
  'Je vais vous parler d’un projet qui me tient à cœur depuis plusieurs mois.',
  'L’idée est simple : rendre la prise de parole accessible à tout le monde.',
  'On a commencé petit, avec trois personnes et une salle prêtée par la mairie.',
  'Aujourd’hui, nous accueillons une trentaine de participants chaque semaine.',
  'Ce qui compte, ce n’est pas de parler fort, c’est de parler juste.',
  'Je me souviens de ma première présentation, j’avais les mains moites.',
  'Depuis, j’ai appris à respirer avant chaque phrase importante.',
  'Notre objectif pour l’année prochaine est d’ouvrir deux nouveaux ateliers.',
  'Je vous remercie pour votre attention et je répondrai à vos questions.',
]

/** Filler word list v1 from docs/DATA-MODEL.md, used by the stub to sprinkle hesitations. */
const BEQUILLES_STUB: readonly string[] = ['euh', 'du coup', 'en fait', 'voilà', 'donc', 'bah']

/**
 * Estimates the duration of an audio file from its bytes.
 * WAV is read exactly; anything else is estimated from the byte count and an assumed bitrate.
 */
export function estimerDuree(audio: Uint8Array, mime: string, debit_kbps: number): number {
  if (mime === 'audio/wav' || mime === 'audio/x-wav' || mime === 'audio/wave') {
    try {
      return lireEnteteWav(audio).duree_s
    } catch {
      // fall through to the estimate
    }
  }
  return (audio.byteLength * 8) / (debit_kbps * 1000)
}

/**
 * Deterministic fake transcriber: produces a French transcript whose length is proportional
 * to the audio duration, with sentence punctuation, a 1 s start delay, pauses between
 * sentences and filler words sprinkled in. It lets the whole pipeline run before the STT
 * provider is chosen. The words are unrelated to the audio content.
 */
export class TranscripteurStub implements Transcripteur {
  readonly fournisseur = 'stub'
  private readonly options: Required<OptionsTranscripteurStub>

  constructor(options: OptionsTranscripteurStub = {}) {
    this.options = {
      graine: options.graine ?? 1,
      mots_par_minute: options.mots_par_minute ?? 140,
      duree_s: options.duree_s ?? -1,
      debit_kbps: options.debit_kbps ?? 64,
    }
  }

  async transcrireFichier(
    audio: Uint8Array,
    options: OptionsTranscription,
  ): Promise<Transcription> {
    const duree_s =
      this.options.duree_s >= 0
        ? this.options.duree_s
        : estimerDuree(audio, options.mime, this.options.debit_kbps)
    return genererTranscriptionStub(duree_s, this.options.graine, this.options.mots_par_minute)
  }
}

/** Builds the fake transcript for a given duration; exported for tests and the bench. */
export function genererTranscriptionStub(
  duree_s: number,
  graine = 1,
  mots_par_minute = 140,
): Transcription {
  const alea = creerAlea(graine)
  const mots: MotTranscrit[] = []
  const dureeMot = 60 / mots_par_minute
  let t = 1.0 // the fake speaker starts after one second
  let indexPhrase = Math.floor(alea() * PHRASES_STUB.length)
  let motsDepuisBequille = 0
  const finUtile = Math.max(0, duree_s - 0.5)

  while (t < finUtile) {
    const phrase = (PHRASES_STUB[indexPhrase % PHRASES_STUB.length] as string).split(' ')
    indexPhrase += 1
    for (let i = 0; i < phrase.length && t < finUtile; i++) {
      // a filler every 10 to 16 words, before the next real word
      if (motsDepuisBequille >= 10 + Math.floor(alea() * 7)) {
        const bequille = BEQUILLES_STUB[Math.floor(alea() * BEQUILLES_STUB.length)] as string
        for (const morceau of bequille.split(' ')) {
          const duree = dureeMot * (0.9 + alea() * 0.4)
          mots.push({
            mot: morceau,
            debut_s: r(t),
            fin_s: r(t + duree),
            confiance: r(0.7 + alea() * 0.2),
          })
          t += duree + 0.05
        }
        t += 0.2
        motsDepuisBequille = 0
        if (t >= finUtile) break
      }
      const texte = phrase[i] as string
      const duree = dureeMot * (0.6 + alea() * 0.8) * Math.min(1.6, 0.5 + texte.length / 6)
      mots.push({
        mot: texte,
        debut_s: r(t),
        fin_s: r(t + duree),
        confiance: r(0.9 + alea() * 0.09),
      })
      t += duree + 0.03 + alea() * 0.05
      motsDepuisBequille += 1
    }
    // pause between sentences, sometimes held
    t += 0.35 + alea() * 0.9
  }

  return { texte: mots.map((m) => m.mot).join(' '), mots }
}

function r(v: number): number {
  return Math.round(v * 1000) / 1000
}
