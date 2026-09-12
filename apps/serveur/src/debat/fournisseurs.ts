/**
 * The three providers a debate needs, each behind an interface, each with a stub that runs the
 * whole loop without a key (decision 13 of the plan, and the same shape as the batch
 * transcriber of Phase 1).
 *
 * They are separate interfaces because the bench may not pick one company for all three: the
 * best French streaming transcription and the best French voice are not obviously the same
 * supplier. Swapping any of them is a config change, never a rewrite.
 */
import type { Logger } from '../log.js'

// --------------------------------------------------------------------------------------------
// Streaming transcription
// --------------------------------------------------------------------------------------------

export interface SegmentTranscrit {
  texte: string
  /** False while the provider may still revise it. */
  definitif: boolean
}

/**
 * One person speaking, transcribed as they speak. `finDeTour` is the provider's endpointing:
 * it fires when the person has stopped, which is what starts the clock we must beat.
 */
export interface FluxTranscription {
  /** One chunk of audio from the app. */
  ecrire(octets: Uint8Array): void
  /** The app said the turn is over; flush whatever is left. */
  terminer(): Promise<void>
  fermer(): void
}

export interface OptionsFlux {
  langue: 'fr'
  surSegment: (segment: SegmentTranscrit) => void
  /** The person stopped talking: here is everything they said, final. */
  surFinDeTour: (texte: string) => void
}

export interface TranscripteurFlux {
  readonly nom: string
  ouvrir(options: OptionsFlux): FluxTranscription
}

// --------------------------------------------------------------------------------------------
// The opponent
// --------------------------------------------------------------------------------------------

export interface ContexteAdversaire {
  these: string
  ton: string
  /** The debate so far, oldest first. */
  tours: ReadonlyArray<{ locuteur: 'utilisateur' | 'retor'; texte: string }>
}

/**
 * Rétor. The cahier is firm on one point: the answer must really answer what was just said. A
 * scripted opponent produces objections that do not match the argument, the person notices at
 * the first turn, and they stop trusting the rest of the application at the same time.
 *
 * Rétor and the debrief are the only French a person reads that this codebase does not write
 * itself, so the system prompt of a real implementation carries the writing rules as a hard
 * constraint, in the model's own instructions: plain French, tutoiement, and none of the
 * constructions banned in docs/STRINGS.md, "How the text must not sound". A model left to its
 * own devices writes exactly the contrastive pairs and aphorisms that section exists to remove
 * ("ce n'est pas un argument, c'est une intuition"), which would undo the pass on every other
 * string in the application. `npm run strings` cannot see runtime text: the prompt is the only
 * place this is enforced, and a sample of real turns is read against the checklist before the
 * provider ships.
 */
export interface Adversaire {
  readonly nom: string
  repondre(contexte: ContexteAdversaire): Promise<string>
  /** The end-of-debate note, written from the transcript and never from the audio (chapter 2). */
  debriefer(contexte: ContexteAdversaire): Promise<Debrief>
}

export interface Debrief {
  /** Two or three moments that mattered, quoted from the transcript. */
  moments: string[]
  /** The one thing to work on next. */
  axe: string
  /** Written by a stubbed opponent, while the providers are not wired. */
  provisoire: boolean
}

// --------------------------------------------------------------------------------------------
// The voice
// --------------------------------------------------------------------------------------------

export interface Voix {
  readonly nom: string
  /**
   * Says a sentence. Chunked, because the app must start playing before the whole answer is
   * synthesised: that is most of the two-second budget.
   */
  dire(texte: string): AsyncIterable<Uint8Array>
}

// --------------------------------------------------------------------------------------------
// Stubs: the whole loop, no key, deterministic
// --------------------------------------------------------------------------------------------

/**
 * Transcribes by counting: every chunk becomes a word. Deterministic, instant, and enough to
 * run the protocol end to end on a simulator before any provider is chosen.
 */
export class TranscripteurFluxStub implements TranscripteurFlux {
  readonly nom = 'stub'

  constructor(private readonly log?: Logger) {}

  ouvrir(options: OptionsFlux): FluxTranscription {
    let morceaux = 0
    let ferme = false
    const texte = () => `Tour transcrit de ${morceaux} morceau${morceaux > 1 ? 'x' : ''}.`
    return {
      ecrire: () => {
        if (ferme) return
        morceaux += 1
        options.surSegment({ texte: texte(), definitif: false })
      },
      terminer: async () => {
        if (ferme) return
        options.surSegment({ texte: texte(), definitif: true })
        options.surFinDeTour(texte())
      },
      fermer: () => {
        ferme = true
        this.log?.debug({ morceaux }, 'flux de transcription ferme')
      },
    }
  }
}

/** Answers something that names the thesis, so a stubbed debate is still readable on screen. */
export class AdversaireStub implements Adversaire {
  readonly nom = 'stub'

  async repondre(contexte: ContexteAdversaire): Promise<string> {
    const tour = contexte.tours.filter((t) => t.locuteur === 'utilisateur').length
    return `Contre-argument ${tour} sur « ${contexte.these} », ton ${contexte.ton}.`
  }

  async debriefer(_contexte: ContexteAdversaire): Promise<Debrief> {
    // No invented moments: they would be the stub's own transcript, which reads as a bug. The
    // screen says the debrief is provisional and shows nothing it would have to make up.
    return {
      moments: [],
      axe: '',
      provisoire: true,
    }
  }
}

/** Says nothing, in chunks. Lets the app exercise its player without a voice provider. */
export class VoixStub implements Voix {
  readonly nom = 'stub'

  async *dire(texte: string): AsyncIterable<Uint8Array> {
    const morceaux = Math.max(1, Math.ceil(texte.length / 40))
    for (let i = 0; i < morceaux; i += 1) yield new Uint8Array(0)
  }
}
