// Composition of the face-à-face: which provider answers, which one transcribes, which one
// speaks. Only the stubs exist until the bench picks the providers and the keys arrive; the
// switch is the single place where that changes (decision 13 of the plan).
import type { NomAdversaire, NomTranscripteurFlux, NomVoix } from '../config.js'
import type { Logger } from '../log.js'
import { AdversaireOpenAI } from '../openai/adversaire.js'
import type { ConfigOpenAI } from '../openai/client.js'
import { TranscripteurFluxOpenAI } from '../openai/flux.js'
import { VoixOpenAI } from '../openai/voix.js'
import {
  AdversaireStub,
  TranscripteurFluxStub,
  VoixStub,
  type Adversaire,
  type TranscripteurFlux,
  type Voix,
} from './fournisseurs.js'

export * from './protocole.js'
export * from './session.js'
export * from './fournisseurs.js'
export { Conduite, type Canal, type DepotDebat, type DebatOuvert } from './conduite.js'

/** A named provider without its key is a configuration error, and it is said at start-up. */
function exigerCle(nom: string, openai: ConfigOpenAI | null): ConfigOpenAI {
  if (!openai) throw new Error(`${nom}=openai demande OPENAI_API_KEY`)
  return openai
}

export function choisirAdversaire(nom: NomAdversaire, openai: ConfigOpenAI | null): Adversaire {
  switch (nom) {
    case 'stub':
      return new AdversaireStub()
    case 'openai':
      return new AdversaireOpenAI(exigerCle('ADVERSAIRE', openai))
  }
}

export function choisirTranscripteurFlux(
  nom: NomTranscripteurFlux,
  openai: ConfigOpenAI | null,
  log?: Logger,
): TranscripteurFlux {
  switch (nom) {
    case 'stub':
      return new TranscripteurFluxStub()
    case 'openai':
      return new TranscripteurFluxOpenAI(exigerCle('TRANSCRIPTEUR_FLUX', openai), log)
  }
}

export function choisirVoix(nom: NomVoix, openai: ConfigOpenAI | null): Voix {
  switch (nom) {
    case 'stub':
      return new VoixStub()
    case 'openai':
      return new VoixOpenAI(exigerCle('VOIX', openai))
  }
}
