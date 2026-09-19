// Speech to text while the person is still speaking, for the face-à-face.
//
// The realtime transcription session over a WebSocket: the phone's 16 kHz PCM goes up as it is
// captured, partial text comes back while the sentence is still going, and the server's own
// voice activity detection says when the person started and stopped speaking.
//
// What this file does NOT do is end the turn. The provider's endpointing fires on a pause, and
// it fired on every pause: at 700 ms of silence it committed the sentence, the conductor took
// that for the end of the turn, and Rétor answered a person who was drawing breath. Everything
// said after that went into a turn the server had already closed. So the boundaries are
// reported and nothing else: segments accumulate into one turn, and the conductor closes it when
// it decides to (`terminer`).
import WebSocket from 'ws'
import type { Logger } from '../log.js'
import type {
  FluxTranscription,
  OptionsFlux,
  TourTranscrit,
  TranscripteurFlux,
} from '../debat/fournisseurs.js'
import { baseDe, type ConfigOpenAI } from './client.js'

/**
 * The phone captures at 16 kHz, which is what a debate needs and what a data plan can carry. The
 * session refuses anything under 24 kHz, so every chunk is brought up on the way in: two samples
 * in, three out, the middle one interpolated. Cheap, and plenty for speech recognition.
 */
export function vers24kHz(octets: Uint8Array, reste: { dernier: number | null }): Buffer {
  const entree = new Int16Array(octets.buffer, octets.byteOffset, Math.floor(octets.byteLength / 2))
  if (entree.length === 0) return Buffer.alloc(0)
  const sortie: number[] = []
  let precedent = reste.dernier ?? entree[0]!
  for (let i = 0; i < entree.length; i += 1) {
    const courant = entree[i]!
    // Three output samples per two input samples: the sample itself, then a point two thirds of
    // the way to the next one; on the odd sample, a point one third past the previous one.
    if (i % 2 === 0) {
      const suivant = i + 1 < entree.length ? entree[i + 1]! : courant
      sortie.push(courant, Math.round(courant + (suivant - courant) * (2 / 3)))
    } else {
      sortie.push(Math.round(precedent + (courant - precedent) * (1 / 3)))
    }
    precedent = courant
  }
  reste.dernier = precedent
  const tampon = Buffer.alloc(sortie.length * 2)
  for (let i = 0; i < sortie.length; i += 1) {
    tampon.writeInt16LE(Math.max(-32768, Math.min(32767, sortie[i]!)), i * 2)
  }
  return tampon
}

/**
 * The silence the provider waits for before it closes a sentence. This is segmentation, not
 * turn taking: at this length it cuts the transcript into readable pieces and says « silence »
 * early enough for the app to start showing the countdown. How long a silence passes the floor
 * is the conductor's business, and it is several times this.
 */
const SILENCE_SEGMENT_MS = 600

/** A commit needs audio behind it: below this the buffer is empty as far as the provider goes. */
const OCTETS_MIN_COMMIT = 3_200

/** How long `terminer` waits for the provider's last words before closing the turn without them. */
const ATTENTE_DERNIER_MOT_MS = 3_000

/** The events the session sends that this file reads. Everything else is ignored on purpose. */
interface EvenementServeur {
  type: string
  delta?: string
  transcript?: string
  error?: { message?: string }
  /** Speech boundaries from the server's voice detection, in milliseconds of audio sent. */
  audio_start_ms?: number
  audio_end_ms?: number
  /** What the provider billed for the turn, in one of the two shapes it uses. */
  usage?: {
    type?: string
    seconds?: number
    input_tokens?: number
    output_tokens?: number
    input_token_details?: { audio_tokens?: number; text_tokens?: number }
  }
}

export class TranscripteurFluxOpenAI implements TranscripteurFlux {
  readonly nom = 'openai:realtime'

  constructor(
    private readonly config: ConfigOpenAI,
    private readonly log?: Logger,
  ) {}

  ouvrir(options: OptionsFlux): FluxTranscription {
    const url = `${baseDe(this.config).replace(/^http/, 'ws')}/v1/realtime?intent=transcription`
    const socket = new WebSocket(url, { headers: { Authorization: `Bearer ${this.config.cle}` } })
    const enAttente: Buffer[] = []
    const reechantillonnage = { dernier: null as number | null }
    let ouvert = false
    let ferme = false
    /** The piece being said, as the provider revises it. */
    let courant = ''
    /** The pieces it has finished with, this turn: the turn is their sum, pauses included. */
    let tour = ''
    /** Bytes of 16 kHz PCM sent since the last completed turn: what the person's speech weighs. */
    let octetsDuTour = 0
    /** Bytes since the provider last closed a sentence: a commit under this is an empty commit. */
    let octetsDepuisCommit = 0
    /** Milliseconds of speech in the turn, from the voice detection's own boundaries. */
    let paroleMsDuTour = 0
    let debutParoleMs: number | null = null
    /** Milliseconds of audio sent since the session opened, the clock the boundaries use. */
    let envoyeMs = 0
    /** Resolved by the next completed sentence, when `terminer` is waiting for one. */
    let resoudreFin: (() => void) | null = null

    const assembler = () => [tour, courant].filter((piece) => piece !== '').join(' ')

    socket.on('open', () => {
      ouvert = true
      socket.send(
        JSON.stringify({
          type: 'session.update',
          session: {
            type: 'transcription',
            audio: {
              input: {
                format: { type: 'audio/pcm', rate: 24000 },
                transcription: { model: 'gpt-4o-mini-transcribe', language: options.langue },
                turn_detection: {
                  type: 'server_vad',
                  threshold: 0.5,
                  prefix_padding_ms: 300,
                  silence_duration_ms: SILENCE_SEGMENT_MS,
                },
              },
            },
          },
        }),
      )
      for (const octets of enAttente) envoyerAudio(octets)
      enAttente.length = 0
    })

    socket.on('message', (brut) => {
      let evenement: EvenementServeur
      try {
        evenement = JSON.parse(String(brut)) as EvenementServeur
      } catch {
        return
      }
      switch (evenement.type) {
        case 'conversation.item.input_audio_transcription.delta':
          courant += evenement.delta ?? ''
          options.surSegment({ texte: assembler(), definitif: false })
          return
        case 'input_audio_buffer.speech_started':
          debutParoleMs = evenement.audio_start_ms ?? envoyeMs
          options.surParole?.(true)
          return
        case 'input_audio_buffer.speech_stopped':
          if (debutParoleMs !== null) {
            paroleMsDuTour += Math.max(0, (evenement.audio_end_ms ?? envoyeMs) - debutParoleMs)
            debutParoleMs = null
          }
          // The person has stopped for now. Whether that stop ends their turn is decided by the
          // conductor, which starts its clock here and shows it on the phone.
          options.surParole?.(false)
          return
        case 'input_audio_buffer.committed':
          octetsDepuisCommit = 0
          return
        case 'conversation.item.input_audio_transcription.completed': {
          const piece = (evenement.transcript ?? courant).trim()
          courant = ''
          octetsDepuisCommit = 0
          if (piece !== '') tour = tour === '' ? piece : `${tour} ${piece}`
          // Tokens are the provider's count, per sentence; the seconds of audio are ours and
          // are reported once, when the turn closes.
          options.surConsommation?.(jetonsDuSegment(evenement.usage))
          options.surSegment({ texte: assembler(), definitif: true })
          resoudreFin?.()
          resoudreFin = null
          return
        }
        case 'error':
          this.log?.warn({ message: evenement.error?.message }, 'openai realtime: erreur')
          // A refused commit must not leave the turn waiting for words that will never come.
          resoudreFin?.()
          resoudreFin = null
          return
        default:
          return
      }
    })

    socket.on('error', (erreur) => {
      this.log?.warn({ err: erreur }, 'openai realtime: socket en erreur')
      resoudreFin?.()
      resoudreFin = null
    })
    socket.on('close', () => {
      ferme = true
      resoudreFin?.()
      resoudreFin = null
    })

    const envoyerAudio = (octets: Uint8Array) => {
      octetsDuTour += octets.byteLength
      octetsDepuisCommit += octets.byteLength
      envoyeMs += octets.byteLength / 32
      const a24 = vers24kHz(octets, reechantillonnage)
      if (a24.length === 0) return
      socket.send(
        JSON.stringify({ type: 'input_audio_buffer.append', audio: a24.toString('base64') }),
      )
    }

    /** Closes the turn's books: what was said, and how long the speech in it lasted. */
    const recolter = (): TourTranscrit => {
      if (debutParoleMs !== null) {
        paroleMsDuTour += Math.max(0, envoyeMs - debutParoleMs)
        debutParoleMs = null
      }
      // A turn the detection said nothing about is counted from the audio it received: 16 kHz,
      // 16-bit, mono, 32 000 bytes a second.
      const dureeS =
        paroleMsDuTour > 0
          ? Math.round(paroleMsDuTour / 10) / 100
          : Math.round((octetsDuTour / 32_000) * 100) / 100
      options.surConsommation?.({
        audio_entree_s: Math.round((octetsDuTour / 32_000) * 100) / 100,
      })
      const texte = assembler()
      tour = ''
      courant = ''
      paroleMsDuTour = 0
      octetsDuTour = 0
      octetsDepuisCommit = 0
      return { texte, dureeS }
    }

    return {
      ecrire: (octets) => {
        if (ferme) return
        if (!ouvert) {
          enAttente.push(Buffer.from(octets))
          return
        }
        envoyerAudio(octets)
      },
      terminer: async () => {
        if (ferme || !ouvert) return recolter()
        // Nothing has been said since the provider closed its last sentence: the turn is
        // already whole, and committing an empty buffer would only earn an error.
        if (octetsDepuisCommit < OCTETS_MIN_COMMIT && courant === '') return recolter()
        await new Promise<void>((resoudre) => {
          const minuteur = setTimeout(() => {
            resoudreFin = null
            resoudre()
          }, ATTENTE_DERNIER_MOT_MS)
          minuteur.unref?.()
          resoudreFin = () => {
            clearTimeout(minuteur)
            resoudre()
          }
          if (octetsDepuisCommit >= OCTETS_MIN_COMMIT) {
            // The floor passes while the person is mid-sentence: end the turn early rather than
            // wait for a silence the provider has not seen.
            socket.send(JSON.stringify({ type: 'input_audio_buffer.commit' }))
          }
        })
        return recolter()
      },
      fermer: () => {
        ferme = true
        resoudreFin?.()
        resoudreFin = null
        try {
          socket.close(1000, 'fin')
        } catch {
          // Already gone.
        }
      },
    }
  }
}

/** Tokens as the provider counts them; our own seconds are added when the turn closes. */
function jetonsDuSegment(usage: EvenementServeur['usage']): {
  audio_entree_s: number
  jetons_audio?: number
  jetons_texte?: number
} {
  const partie: { audio_entree_s: number; jetons_audio?: number; jetons_texte?: number } = {
    audio_entree_s: 0,
  }
  const audio = usage?.input_token_details?.audio_tokens ?? usage?.input_tokens
  if (typeof audio === 'number') partie.jetons_audio = audio
  if (typeof usage?.output_tokens === 'number') partie.jetons_texte = usage.output_tokens
  return partie
}
