import type { NomTranscripteur } from '../config.js'
import type { ConfigOpenAI } from '../openai/client.js'
import { TranscripteurOpenAI } from '../openai/transcripteur.js'
import { TranscripteurStub } from './stub.js'
import type { Transcripteur } from './transcripteur.js'

export type { EntreeTranscription, Transcripteur } from './transcripteur.js'
export { typeMimeDepuisChemin } from './transcripteur.js'
export { TranscripteurStub } from './stub.js'

/** Picks the provider named by TRANSCRIPTEUR. */
export function choisirTranscripteur(
  nom: NomTranscripteur,
  openai: ConfigOpenAI | null,
): Transcripteur {
  switch (nom) {
    case 'stub':
      return new TranscripteurStub()
    case 'openai':
      if (!openai) throw new Error('TRANSCRIPTEUR=openai demande OPENAI_API_KEY')
      return new TranscripteurOpenAI(openai)
  }
}
