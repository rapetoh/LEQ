// Composition of the face-à-face: which provider answers, which one transcribes, which one
// speaks. Only the stubs exist until the bench picks the providers and the keys arrive; the
// switch is the single place where that changes (decision 13 of the plan).
import type { NomAdversaire, NomTranscripteurFlux, NomVoix } from '../config.js'
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

export function choisirAdversaire(nom: NomAdversaire): Adversaire {
  switch (nom) {
    case 'stub':
      return new AdversaireStub()
  }
}

export function choisirTranscripteurFlux(nom: NomTranscripteurFlux): TranscripteurFlux {
  switch (nom) {
    case 'stub':
      return new TranscripteurFluxStub()
  }
}

export function choisirVoix(nom: NomVoix): Voix {
  switch (nom) {
    case 'stub':
      return new VoixStub()
  }
}
