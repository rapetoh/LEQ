export type { Pcm, PistesProsodie, Intervalle } from './types.js'
export type { MotTranscrit } from './domaine.js'
export {
  TranscripteurStub,
  genererTranscriptionStub,
  estimerDuree,
  type Transcripteur,
  type TranscripteurFlux,
  type SessionFlux,
  type EvenementFlux,
  type OptionsFlux,
  type OptionsTranscription,
  type OptionsTranscripteurStub,
} from './transcripteur.js'
export {
  ProsodieStub,
  extraireProsodieStub,
  type ExtracteurProsodie,
  type OptionsProsodieStub,
} from './prosodie.js'
export { mesurer, VERSION_MESURES, type EntreeMesure } from './mesurer.js'
export { calculerWer, type ResultatWer } from './wer.js'
export { normaliserTexte, normaliserMot, termineUnePhrase } from './texte.js'
export { decoderWav, encoderWav, lireEnteteWav, type EnteteWav } from './wav.js'
export { mesurerDebit, type MesureDebit, type FenetreDebit } from './mesures/debit.js'
export {
  mesurerMotsBequilles,
  LISTE_BEQUILLES_V1,
  type MesureMotsBequilles,
} from './mesures/motsBequilles.js'
export {
  mesurerSilences,
  tempsAvantDemarrage,
  dureeParole,
  type MesureSilences,
  type PlaceSilence,
} from './mesures/silences.js'
export { mesurerSouffle, type MesureSouffle } from './mesures/souffle.js'
export { mesurerVolume, niveauxParTrame, type MesureVolume } from './mesures/volume.js'
export { mesurerHauteur, type MesureHauteur } from './mesures/hauteur.js'
export { mesurerRepetitions, type MesureRepetitions } from './mesures/repetitions.js'
export {
  mesurerPhrases,
  decouperPhrases,
  type MesurePhrases,
  type Phrase,
} from './mesures/phrases.js'
