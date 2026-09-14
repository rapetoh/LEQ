// Speech to text while the person is still speaking, for the face-à-face.
//
// The realtime transcription session over a WebSocket: the phone's 16 kHz PCM goes up as it is
// captured, partial text comes back while the sentence is still going, and the server's own
// voice activity detection says when the person has stopped. That last event is the one the
// whole debate waits on: it is what starts the clock we have two seconds to beat.
import WebSocket from 'ws'
import type { Logger } from '../log.js'
import type { FluxTranscription, OptionsFlux, TranscripteurFlux } from '../debat/fournisseurs.js'
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

/** The events the session sends that this file reads. Everything else is ignored on purpose. */
interface EvenementServeur {
  type: string
  delta?: string
  transcript?: string
  error?: { message?: string }
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
    let courant = ''
    /** Bytes of 16 kHz PCM sent since the last completed turn: what the person's speech weighs. */
    let octetsDuTour = 0
    /** Resolved when the provider has flushed the turn after `terminer()`. */
    let resoudreFin: (() => void) | null = null

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
                  silence_duration_ms: 700,
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
          options.surSegment({ texte: courant, definitif: false })
          return
        case 'conversation.item.input_audio_transcription.completed': {
          const texte = (evenement.transcript ?? courant).trim()
          courant = ''
          options.surConsommation?.(consommationDuTour(octetsDuTour, evenement.usage))
          octetsDuTour = 0
          options.surSegment({ texte, definitif: true })
          options.surFinDeTour(texte)
          resoudreFin?.()
          resoudreFin = null
          return
        }
        case 'error':
          this.log?.warn({ message: evenement.error?.message }, 'openai realtime: erreur')
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
      const a24 = vers24kHz(octets, reechantillonnage)
      if (a24.length === 0) return
      socket.send(
        JSON.stringify({ type: 'input_audio_buffer.append', audio: a24.toString('base64') }),
      )
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
      terminer: () =>
        new Promise<void>((resoudre) => {
          if (ferme || !ouvert) {
            // Nothing ever reached the provider: the turn is empty, and saying so lets the
            // conductor move on instead of waiting for a completion that will never come.
            if (courant === '') options.surFinDeTour('')
            resoudre()
            return
          }
          resoudreFin = resoudre
          // The person pressed the button before the VAD noticed the silence: commit what is
          // there. The completion event then closes the turn like any other.
          socket.send(JSON.stringify({ type: 'input_audio_buffer.commit' }))
        }),
      fermer: () => {
        ferme = true
        try {
          socket.close(1000, 'fin')
        } catch {
          // Already gone.
        }
      },
    }
  }
}

/** The seconds are ours (16 kHz, 16-bit, mono: 32 000 bytes a second); the tokens are theirs. */
function consommationDuTour(
  octets: number,
  usage: EvenementServeur['usage'],
): { audio_entree_s: number; jetons_audio?: number; jetons_texte?: number } {
  const partie: { audio_entree_s: number; jetons_audio?: number; jetons_texte?: number } = {
    audio_entree_s: Math.round((octets / 32_000) * 100) / 100,
  }
  const audio = usage?.input_token_details?.audio_tokens ?? usage?.input_tokens
  if (typeof audio === 'number') partie.jetons_audio = audio
  if (typeof usage?.output_tokens === 'number') partie.jetons_texte = usage.output_tokens
  return partie
}
