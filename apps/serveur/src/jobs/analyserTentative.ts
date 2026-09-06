// The analysis pipeline, in the order of the state diagram (diagrammes-LEQ.md, 2):
//   envoyee -> en_transcription -> en_mesure -> en_evaluation -> audio_supprime -> retour_disponible
//   any failure -> echec_technique (retry by echouer_job) -> abandon_technique after the last try.
// Every dependency is injected so the order of writes is testable without a database.
import { z } from 'zod'
import type {
  ExtracteurProsodie,
  FonctionEvaluerRegle,
  FonctionMesurer,
  Mesures,
} from '../contrat.js'
import type { Decodeur } from '../audio/decoder.js'
import type {
  GrillePubliee,
  NouvelleAnalyse,
  NouvelleEvaluation,
  ResultatTentative,
  StatutTentative,
  Tentative,
} from '../db.js'
import { messageErreur } from '../log.js'
import type { Transcripteur } from '../transcription/index.js'
import { typeMimeDepuisChemin } from '../transcription/index.js'
import type { ContexteJob, HandlerJob } from './types.js'

export const VERSION_SCHEMA_ANALYSE = 1

export class ErreurPipeline extends Error {
  override name = 'ErreurPipeline'
}

/** The database operations the pipeline needs, implemented by db.ts and faked in tests. */
export interface DepotAnalyse {
  lireTentative(id: string): Promise<Tentative | null>
  mettreAJourStatut(id: string, statut: StatutTentative): Promise<void>
  mettreAJourDuree(id: string, dureeS: number): Promise<void>
  lireGrillePubliee(): Promise<GrillePubliee | null>
  /** Must write both rows in one transaction. */
  enregistrerAnalyseEtEvaluation(
    analyse: NouvelleAnalyse,
    evaluation: NouvelleEvaluation,
  ): Promise<ResultatTentative | null>
  marquerAudioSupprime(id: string): Promise<void>
  marquerEchecTechnique(id: string, erreur: string): Promise<void>
  marquerAbandonTechnique(id: string, audioSupprime: boolean, erreur?: string): Promise<void>
}

/** The audio-tentatives bucket, reduced to what the pipeline does with it. */
export interface StockageAudioTentatives {
  telecharger(chemin: string): Promise<Buffer>
  supprimer(chemin: string): Promise<void>
}

export interface DependancesAnalyse {
  depot: DepotAnalyse
  /** Tells the person their feedback is ready. Must never throw. */
  notifier: (utilisateurId: string, tentativeId: string) => Promise<unknown>
  stockage: StockageAudioTentatives
  transcripteur: Transcripteur
  decoder: Decodeur
  prosodie: ExtracteurProsodie
  mesurer: FonctionMesurer
  evaluerRegle: FonctionEvaluerRegle
}

export type ResultatAnalyse =
  'analysee' | 'introuvable' | 'deja_traitee' | 'reprise_apres_suppression'

const SchemaCharge = z.object({ tentative_id: z.uuid() })

export function creerHandlerAnalyserTentative(deps: DependancesAnalyse): HandlerJob {
  return async (job, contexte) => {
    const charge = SchemaCharge.safeParse(job.charge)
    if (!charge.success) {
      throw new ErreurPipeline(
        `Invalid charge for analyser_tentative: ${z.prettifyError(charge.error)}`,
      )
    }
    await analyserTentative(deps, charge.data.tentative_id, contexte)
  }
}

/**
 * Builds the evaluation row. Without a published grid: empty sous_notes and null
 * note_totale (the contract). With one: every critere is scored by evaluerRegle,
 * note_totale is the sum of the scores. seuil_reussite comes from the step (Phase 4), null now.
 */
export function construireEvaluation(
  tentativeId: string,
  grille: GrillePubliee | null,
  mesures: Mesures,
  evaluerRegle: FonctionEvaluerRegle,
): NouvelleEvaluation {
  if (!grille) {
    return {
      tentative_id: tentativeId,
      grille_id: null,
      version_grille: null,
      sous_notes: {},
      note_totale: null,
      seuil_reussite: null,
    }
  }
  const sous_notes: NouvelleEvaluation['sous_notes'] = {}
  let total = 0
  for (const critere of grille.criteres) {
    const note = evaluerRegle(critere.regle, mesures)
    sous_notes[critere.cle] = { score: note.score, max: note.max }
    total += note.score
  }
  return {
    tentative_id: tentativeId,
    grille_id: grille.id,
    version_grille: grille.version,
    sous_notes,
    note_totale: Math.round(total * 100) / 100,
    seuil_reussite: null,
  }
}

export async function analyserTentative(
  deps: DependancesAnalyse,
  tentativeId: string,
  contexte: ContexteJob,
): Promise<ResultatAnalyse> {
  const { depot, stockage } = deps
  const log = contexte.log.child({ tentative_id: tentativeId })

  const tentative = await depot.lireTentative(tentativeId)
  if (!tentative) {
    // The user (and the row, by cascade) is gone. Nothing to do, the job is done.
    log.warn('tentative introuvable, job ignore')
    return 'introuvable'
  }
  if (tentative.statut === 'retour_disponible' || tentative.statut === 'abandon_technique') {
    log.info({ statut: tentative.statut }, 'tentative deja traitee')
    return 'deja_traitee'
  }
  if (tentative.statut === 'audio_supprime') {
    // A previous run committed and deleted the audio but died before the last write.
    await depot.mettreAJourStatut(tentativeId, 'retour_disponible')
    log.info('reprise apres suppression de l audio')
    return 'reprise_apres_suppression'
  }

  const cheminAudio = tentative.chemin_audio
  try {
    if (!cheminAudio) throw new ErreurPipeline('chemin_audio is null, nothing to analyse')

    // Transcription
    await depot.mettreAJourStatut(tentativeId, 'en_transcription')
    const octets = await stockage.telecharger(cheminAudio)
    const transcription = await deps.transcripteur.transcrire({
      octets,
      typeMime: typeMimeDepuisChemin(cheminAudio),
      langue: 'fr',
    })
    log.debug({ fournisseur: deps.transcripteur.nom }, 'transcription obtenue')

    // Mesure
    await depot.mettreAJourStatut(tentativeId, 'en_mesure')
    const audio = await deps.decoder(octets)
    await depot.mettreAJourDuree(tentativeId, audio.dureeS)
    const prosodie = await deps.prosodie.extraire(audio.pcm, audio.frequenceHz)
    const mesures = deps.mesurer({
      pcm: audio.pcm,
      frequence_hz: audio.frequenceHz,
      transcription,
      prosodie,
    })
    log.debug({ duree_s: audio.dureeS }, 'mesures calculees')

    // Evaluation
    await depot.mettreAJourStatut(tentativeId, 'en_evaluation')
    const grille = await depot.lireGrillePubliee()
    const evaluation = construireEvaluation(tentativeId, grille, mesures, deps.evaluerRegle)
    const analyse: NouvelleAnalyse = {
      tentative_id: tentativeId,
      version_schema: VERSION_SCHEMA_ANALYSE,
      mesures,
      transcription,
      fournisseur_transcription: deps.transcripteur.nom,
    }
    const resultat = await depot.enregistrerAnalyseEtEvaluation(analyse, evaluation)
    log.info(
      { grille_version: evaluation.version_grille, resultat },
      'analyse et evaluation enregistrees',
    )

    // AudioSupprime, then RetourDisponible
    await stockage.supprimer(cheminAudio)
    await depot.marquerAudioSupprime(tentativeId)
    await depot.mettreAJourStatut(tentativeId, 'retour_disponible')
    log.info('retour disponible')
    await deps.notifier(tentative.utilisateur_id, tentativeId)
    return 'analysee'
  } catch (erreur) {
    const message = messageErreur(erreur)
    log.error({ err: erreur, dernier_essai: contexte.dernierEssai }, 'echec technique')
    try {
      await depot.marquerEchecTechnique(tentativeId, message)
    } catch (erreurEcriture) {
      log.error({ err: erreurEcriture }, 'impossible d ecrire echec_technique')
    }
    if (contexte.dernierEssai) {
      // Never leave audio behind: try to delete it here too, then record the abandon.
      let audioSupprime = cheminAudio === null
      if (cheminAudio) {
        try {
          await stockage.supprimer(cheminAudio)
          audioSupprime = true
        } catch (erreurSuppression) {
          log.error(
            { err: erreurSuppression },
            'audio non supprime apres abandon, le balayage le reprendra',
          )
        }
      }
      try {
        await depot.marquerAbandonTechnique(tentativeId, audioSupprime, message)
      } catch (erreurEcriture) {
        log.error({ err: erreurEcriture }, 'impossible d ecrire abandon_technique')
      }
    }
    throw erreur
  }
}
