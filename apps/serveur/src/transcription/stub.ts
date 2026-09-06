// STUB: no speech-to-text provider is chosen yet (the Phase 2 bench decides).
// It delegates to the engine's deterministic fake transcriber, which produces a
// French transcript proportional to the audio duration with sentence
// punctuation, pauses and filler words, so the whole pipeline and the feedback
// screens can be exercised end to end. The words are unrelated to what was
// said; analyses.fournisseur_transcription = 'stub' records that.
import { TranscripteurStub as TranscripteurStubMoteur } from '@leq/moteur'
import type { Transcription } from '../contrat.js'
import type { EntreeTranscription, Transcripteur } from './transcripteur.js'

export class TranscripteurStub implements Transcripteur {
  readonly nom = 'stub'
  private readonly moteur = new TranscripteurStubMoteur()

  async transcrire(entree: EntreeTranscription): Promise<Transcription> {
    return this.moteur.transcrireFichier(entree.octets, {
      mime: entree.typeMime,
      langue: entree.langue,
    })
  }
}
