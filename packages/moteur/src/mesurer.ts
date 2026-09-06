/**
 * Entry point of the engine: PCM, timed transcript and prosody tracks in, `MesuresV1` out.
 * Deterministic and synchronous; the result is validated against the domain schema so a
 * drift between this engine and the contract fails loudly here, not in the database.
 */
import { MesuresV1Schema, type MesuresV1, type Transcription } from './domaine.js'
import { mesurerDebit } from './mesures/debit.js'
import { mesurerHauteur } from './mesures/hauteur.js'
import { mesurerMotsBequilles } from './mesures/motsBequilles.js'
import { mesurerPhrases } from './mesures/phrases.js'
import { mesurerRepetitions } from './mesures/repetitions.js'
import { dureeParole, mesurerSilences, tempsAvantDemarrage } from './mesures/silences.js'
import { mesurerSouffle } from './mesures/souffle.js'
import { mesurerVolume } from './mesures/volume.js'
import { arrondirNombre } from './stats.js'
import type { Pcm, PistesProsodie } from './types.js'

export interface EntreeMesure {
  pcm: Pcm
  transcription: Transcription
  prosodie: PistesProsodie
  /** Filler word list, from `configuration` in Phase 6, `LISTE_BEQUILLES_V1` until then. */
  listeBequilles: readonly string[]
}

export const VERSION_MESURES = 1

export function mesurer(entree: EntreeMesure): MesuresV1 {
  const { pcm, transcription, prosodie, listeBequilles } = entree
  const mots = [...transcription.mots].sort((a, b) => a.debut_s - b.debut_s)
  const duree_totale_s = arrondirNombre(pcm.echantillons.length / pcm.frequence_hz, 3)

  const silences = mesurerSilences(mots)
  const duree_parole_s = dureeParole(mots, silences)
  const premier = mots[0]
  const dernier = mots[mots.length - 1]
  const etendue =
    premier !== undefined && dernier !== undefined
      ? { debut_s: premier.debut_s, fin_s: dernier.fin_s }
      : undefined

  const mesures = {
    version: VERSION_MESURES,
    duree_totale_s,
    duree_parole_s,
    temps_avant_demarrage_s: tempsAvantDemarrage(mots),
    debit: mesurerDebit(mots, duree_totale_s),
    mots_bequilles: mesurerMotsBequilles(mots, listeBequilles, duree_parole_s),
    silences,
    souffle: mesurerSouffle(mots),
    volume: mesurerVolume(pcm, mots),
    hauteur: mesurerHauteur(prosodie, etendue),
    repetitions: mesurerRepetitions(mots),
    phrases: mesurerPhrases(mots),
  }

  return MesuresV1Schema.parse(mesures)
}
