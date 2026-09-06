// balayer_audio: the safety net behind the pipeline (decision 6 of the plan).
// Objects of audio-tentatives older than configuration.balayage_audio_heures are
// removed when nothing will ever use them again:
//   - no tentative row (upload without insert): deleted;
//   - tentative past the audio stage (audio_supprime, retour_disponible,
//     abandon_technique): deleted, chemin_audio cleared, audio_supprime_le stamped;
//   - tentative still before the audio stage: kept while its analyser job is
//     waiting or running (a long outage must not turn retries into an abandon),
//     otherwise nothing will process it: deleted and marked abandon_technique.
import {
  existeJobActif,
  lireConfigurationNombre,
  listerObjetsStockage,
  listerTentativesParIds,
  marquerAbandonTechnique,
  marquerCheminAudioSupprime,
  STATUTS_AVANT_SUPPRESSION,
  type Executeur,
  type Tentative,
} from '../db.js'
import { BUCKET_AUDIO_TENTATIVES, type Stockage } from '../stockage.js'
import type { HandlerJob } from './types.js'

export const BALAYAGE_AUDIO_HEURES_DEFAUT = 6

const MESSAGE_ABANDON_BALAYAGE =
  'Audio supprimé par le balayage de sécurité avant la fin de l analyse.'

export interface DependancesBalayage {
  ex: Executeur
  stockage: Stockage
}

/** `{utilisateur_id}/{tentative_id}.m4a` -> tentative id, or null for any other shape. */
export function tentativeIdDepuisChemin(chemin: string): string | null {
  const m = /^[0-9a-f-]{36}\/([0-9a-f-]{36})\.[a-z0-9]+$/i.exec(chemin)
  return m?.[1] ?? null
}

export function creerHandlerBalayerAudio(deps: DependancesBalayage): HandlerJob {
  return async (_job, contexte) => {
    const log = contexte.log
    const heures = await lireConfigurationNombre(
      deps.ex,
      'balayage_audio_heures',
      BALAYAGE_AUDIO_HEURES_DEFAUT,
    )
    const objets = await listerObjetsStockage(deps.ex, BUCKET_AUDIO_TENTATIVES, {
      plusVieuxQueHeures: heures,
    })
    if (objets.length === 0) {
      log.info({ heures }, 'balayage: rien a supprimer')
      return
    }

    const ids = objets
      .map((o) => tentativeIdDepuisChemin(o.name))
      .filter((id): id is string => id !== null)
    const tentatives = new Map<string, Tentative>()
    for (const t of await listerTentativesParIds(deps.ex, ids)) tentatives.set(t.id, t)

    const aSupprimer: string[] = []
    const cheminsASupprimer: string[] = []
    const abandons: string[] = []
    let conserves = 0

    for (const objet of objets) {
      const id = tentativeIdDepuisChemin(objet.name)
      const tentative = id ? tentatives.get(id) : undefined
      if (!tentative) {
        aSupprimer.push(objet.name)
        continue
      }
      if (!STATUTS_AVANT_SUPPRESSION.includes(tentative.statut)) {
        aSupprimer.push(objet.name)
        cheminsASupprimer.push(tentative.id)
        continue
      }
      if (await existeJobActif(deps.ex, `analyser:${tentative.id}`)) {
        conserves += 1
        log.warn(
          { tentative_id: tentative.id, statut: tentative.statut, cree_le: objet.created_at },
          'balayage: audio ancien mais analyse encore en attente, conserve',
        )
        continue
      }
      aSupprimer.push(objet.name)
      abandons.push(tentative.id)
    }

    await deps.stockage.supprimer(BUCKET_AUDIO_TENTATIVES, aSupprimer)
    for (const id of cheminsASupprimer) await marquerCheminAudioSupprime(deps.ex, id)
    for (const id of abandons)
      await marquerAbandonTechnique(deps.ex, id, true, MESSAGE_ABANDON_BALAYAGE)

    log.info(
      {
        heures,
        objets: objets.length,
        supprimes: aSupprimer.length,
        orphelins: aSupprimer.length - cheminsASupprimer.length - abandons.length,
        abandons: abandons.length,
        conserves,
      },
      'balayage termine',
    )
  }
}
