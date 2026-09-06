// Batch speech-to-text behind an interface (decision 13 of the plan).
// The streaming mode for the debate is added in Phase 8.
import type { Transcription } from '../contrat.js'

export interface EntreeTranscription {
  /** The original container as uploaded (m4a/AAC from the phone, webm/opus from the browser). */
  octets: Uint8Array
  /** MIME type guessed from the object path, e.g. audio/mp4. */
  typeMime: string
  /** BCP 47 language tag. Always fr for now. */
  langue: 'fr'
}

export interface Transcripteur {
  /** Written into analyses.fournisseur_transcription. */
  readonly nom: string
  transcrire(entree: EntreeTranscription): Promise<Transcription>
}

/** MIME type from the object path extension. */
export function typeMimeDepuisChemin(chemin: string): string {
  const extension = chemin.toLowerCase().split('.').pop() ?? ''
  switch (extension) {
    case 'm4a':
    case 'mp4':
      return 'audio/mp4'
    case 'webm':
      return 'audio/webm'
    case 'wav':
      return 'audio/wav'
    case 'ogg':
    case 'opus':
      return 'audio/ogg'
    case 'mp3':
      return 'audio/mpeg'
    default:
      return 'application/octet-stream'
  }
}
