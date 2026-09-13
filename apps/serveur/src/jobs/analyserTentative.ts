// The analysis pipeline, in the order of the state diagram (diagrammes-LEQ.md, 2):
//   envoyee -> en_transcription -> en_mesure -> en_evaluation -> audio_supprime -> retour_disponible
//   any failure -> echec_technique (retry by echouer_job) -> abandon_technique after the last try.
// Every dependency is injected so the order of writes is testable without a database.
import {
  composerNote,
  partNormalisee,
  type ObservationHorsGrille,
  type SousNote,
} from '@leq/domaine'
import { z } from 'zod'
import type {
  ExtracteurProsodie,
  FonctionEvaluerRegle,
  FonctionMesurer,
  Mesures,
} from '../contrat.js'
import type { Decodeur } from '../audio/decoder.js'
import type {
  CritereGrille,
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

/**
 * What the model gives back after listening: a score for each judged axis, against Rebecca's
 * reference, and what it noticed that no criterion covers.
 */
export interface Jugement {
  sous_notes: Record<string, SousNote>
  hors_grille: ObservationHorsGrille[]
}

/** The balance between the two halves of a note, and what the note is out of. Rebecca's to move. */
export interface PoidsNote {
  mesure: number
  jugement: number
  noteMax: number
}

export const POIDS_PAR_DEFAUT: PoidsNote = { mesure: 0.65, jugement: 0.35, noteMax: 30 }

export class ErreurPipeline extends Error {
  override name = 'ErreurPipeline'
}

/**
 * What listens to the whole performance and scores what cannot be measured.
 *
 * It judges against Rebecca's reference, held by the two worked examples on each axis, and not
 * against its own idea of a good speaker. It also reports what it noticed outside the grid: that
 * never enters the note, and it is how the grid grows from what the application actually hears.
 */
export interface Juge {
  readonly nom: string
  juger(contexte: {
    transcription: { texte: string }
    mesures: Mesures
    criteres: readonly CritereGrille[]
    criteresCouverts: readonly string[]
  }): Promise<Jugement>
}

/** The database operations the pipeline needs, implemented by db.ts and faked in tests. */
export interface DepotAnalyse {
  lireTentative(id: string): Promise<Tentative | null>
  mettreAJourStatut(id: string, statut: StatutTentative): Promise<void>
  mettreAJourDuree(id: string, dureeS: number): Promise<void>
  lireGrillePubliee(): Promise<GrillePubliee | null>
  /** The balance between the measured and the judged halves, and what the note is out of. */
  lirePoidsNote(): Promise<PoidsNote>
  /** The filler words Rebecca edits in the admin (configuration `mots_bequilles`). */
  lireMotsBequilles(): Promise<readonly string[]>
  /** Must write both rows in one transaction. */
  enregistrerAnalyseEtEvaluation(
    analyse: NouvelleAnalyse,
    evaluation: NouvelleEvaluation,
  ): Promise<ResultatTentative | null>
  marquerAudioSupprime(id: string): Promise<void>
  /** Records where the public copy lives, before the private object is deleted. */
  enregistrerCheminPublic(id: string, chemin: string): Promise<void>
  marquerEchecTechnique(id: string, erreur: string): Promise<void>
  marquerAbandonTechnique(id: string, audioSupprime: boolean, erreur?: string): Promise<void>
}

/** The audio-tentatives bucket, reduced to what the pipeline does with it. */
export interface StockageAudioTentatives {
  telecharger(chemin: string): Promise<Buffer>
  supprimer(chemin: string): Promise<void>
  /**
   * Copies a take into `audio-public` and answers its path there. Only for an Arena or duel
   * take: chapter 2's single exception, the recording that stays online for the time of the
   * contest and is deleted at its close.
   */
  copierVersPublic(chemin: string, octets: Buffer): Promise<string>
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
  /** Absent while no key is wired: the measured half then carries the note on its own. */
  juge?: Juge
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
/**
 * The note, from its two halves (chapter 5, rewritten 12 September 2026).
 *
 * Four axes are computed from what the machine hears. Two are judged by the model against
 * Rebecca's reference, held in place by a worked example at five and one at two. The split
 * between the halves is a setting, not an accident of how many axes sit in each group: adding a
 * fifth measured axis must not quietly move the balance.
 *
 * What the model noticed outside the grid never enters the note, and always reaches the person.
 */
export function construireEvaluation(
  tentativeId: string,
  grille: GrillePubliee | null,
  mesures: Mesures,
  evaluerRegle: FonctionEvaluerRegle,
  jugement: Jugement | null = null,
  poids: PoidsNote = POIDS_PAR_DEFAUT,
): NouvelleEvaluation {
  if (!grille) {
    return {
      tentative_id: tentativeId,
      grille_id: null,
      version_grille: null,
      sous_notes: {},
      note_totale: null,
      note_mesure: null,
      note_jugement: null,
      hors_grille: jugement?.hors_grille ?? [],
      seuil_reussite: null,
    }
  }
  const sous_notes: NouvelleEvaluation['sous_notes'] = {}
  const clesMesure: string[] = []
  const clesJugement: string[] = []
  for (const critere of grille.criteres) {
    if (critere.source === 'jugement') {
      const note = jugement?.sous_notes[critere.cle]
      // A judged axis the model did not answer on is left out rather than scored zero: zero says
      // the person did badly, and nothing was measured at all.
      if (!note) continue
      sous_notes[critere.cle] = { score: note.score, max: note.max }
      clesJugement.push(critere.cle)
      continue
    }
    const note = evaluerRegle(critere.regle, mesures)
    sous_notes[critere.cle] = { score: note.score, max: note.max }
    clesMesure.push(critere.cle)
  }
  const partMesure = partNormalisee(sous_notes, clesMesure)
  const partJugement = partNormalisee(sous_notes, clesJugement)
  return {
    tentative_id: tentativeId,
    grille_id: grille.id,
    version_grille: grille.version,
    sous_notes,
    note_totale: composerNote({
      mesure: partMesure,
      jugement: partJugement,
      poidsMesure: poids.mesure,
      poidsJugement: poids.jugement,
      noteMax: poids.noteMax,
    }),
    note_mesure: partMesure,
    note_jugement: partJugement,
    hors_grille: jugement?.hors_grille ?? [],
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
    const listeBequilles = await depot.lireMotsBequilles()
    const mesures = deps.mesurer(
      {
        pcm: audio.pcm,
        frequence_hz: audio.frequenceHz,
        transcription,
        prosodie,
      },
      listeBequilles,
    )
    log.debug({ duree_s: audio.dureeS }, 'mesures calculees')

    // Evaluation
    await depot.mettreAJourStatut(tentativeId, 'en_evaluation')
    const grille = await depot.lireGrillePubliee()
    const poids = await depot.lirePoidsNote()
    // The judged axes, scored against Rebecca's reference. Without a judge, or without any judged
    // axis, the measured half carries the note on its own.
    const aJuger = (grille?.criteres ?? []).filter((c) => c.source === 'jugement')
    const jugement =
      deps.juge && aJuger.length > 0
        ? await deps.juge.juger({
            transcription,
            mesures,
            criteres: aJuger,
            criteresCouverts: (grille?.criteres ?? []).map((c) => c.nom),
          })
        : null
    const evaluation = construireEvaluation(
      tentativeId,
      grille,
      mesures,
      deps.evaluerRegle,
      jugement,
      poids,
    )
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

    // An Arena or duel take keeps a copy in `audio-public` for the time of the contest: without
    // it `publier_prise` had nothing to copy, and the Arena asked people to compare two voices
    // they could not hear. Written before the private object goes, so a failure here leaves the
    // take intact rather than silent.
    if (tentative.type === 'arene' || tentative.type === 'duel') {
      const cheminPublic = await stockage.copierVersPublic(cheminAudio, octets)
      await depot.enregistrerCheminPublic(tentativeId, cheminPublic)
      log.info({ chemin_public: cheminPublic }, 'copie publique conservee')
    }

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
