import type { NomTranscripteur } from '../config.js'
import { TranscripteurStub } from './stub.js'
import type { Transcripteur } from './transcripteur.js'

export type { EntreeTranscription, Transcripteur } from './transcripteur.js'
export { typeMimeDepuisChemin } from './transcripteur.js'
export { TranscripteurStub } from './stub.js'

/** Picks the provider named by TRANSCRIPTEUR. Only the stub exists until the bench decides. */
export function choisirTranscripteur(nom: NomTranscripteur): Transcripteur {
  switch (nom) {
    case 'stub':
      return new TranscripteurStub()
  }
}
