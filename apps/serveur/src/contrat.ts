// The single place where the server touches the sibling packages.
// Every name follows docs/DATA-MODEL.md; if a signature in @leq/domaine or
// @leq/moteur changes, this file is the only one to adapt.
import type { Mesures, RegleCritere, Transcription } from '@leq/domaine'
import { evaluerRegle as evaluerRegleDomaine, MOTS_BEQUILLES_V1 } from '@leq/domaine'
import { mesurer as mesurerMoteur } from '@leq/moteur'

export type { Mesures, RegleCritere, Transcription }

/** Pitch and intensity tracks on one common time grid (`pas_s`), null where unvoiced or undefined. */
export interface PisteProsodie {
  pas_s: number
  f0_hz: (number | null)[]
  intensite_db: (number | null)[]
}

/** "PCM in, F0 and intensity tracks out" (decision 2 of the plan). */
export interface ExtracteurProsodie {
  extraire(pcm: Float32Array, frequenceHz: number): Promise<PisteProsodie>
}

export interface EntreeMesure {
  pcm: Float32Array
  frequence_hz: number
  transcription: Transcription
  prosodie: PisteProsodie
}

export type FonctionMesurer = (entree: EntreeMesure, listeBequilles?: readonly string[]) => Mesures

export interface SousNote {
  score: number
  max: number
}

export type FonctionEvaluerRegle = (regle: RegleCritere, mesures: Mesures) => SousNote

/** The v1 list of the contract, used when `configuration.mots_bequilles` is missing. */
export const LISTE_BEQUILLES_PAR_DEFAUT: readonly string[] = MOTS_BEQUILLES_V1

/** The filler-word list comes from `configuration` (Phase 6), the contract's v1 list otherwise. */
export const mesurer: FonctionMesurer = (entree, listeBequilles = LISTE_BEQUILLES_PAR_DEFAUT) =>
  mesurerMoteur({
    pcm: { echantillons: entree.pcm, frequence_hz: entree.frequence_hz },
    transcription: entree.transcription,
    prosodie: entree.prosodie,
    listeBequilles,
  })

export const evaluerRegle: FonctionEvaluerRegle = (regle, mesures) => {
  const resultat = evaluerRegleDomaine(regle, mesures)
  return { score: resultat.score, max: resultat.max }
}
