import { pino } from 'pino'
import { describe, expect, it } from 'vitest'
import type { Mesures, Transcription } from '../contrat.js'
import type {
  GrillePubliee,
  NouvelleAnalyse,
  NouvelleEvaluation,
  StatutTentative,
  Tentative,
} from '../db.js'
import {
  analyserTentative,
  construireEvaluation,
  type DependancesAnalyse,
  type DepotAnalyse,
} from './analyserTentative.js'

const ID = '1a1a1a1a-1a1a-4a1a-8a1a-1a1a1a1a1a1a'
const UTILISATEUR = '0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f'
const CHEMIN = `${UTILISATEUR}/${ID}.m4a`
const log = pino({ level: 'silent' })

function tentative(statut: StatutTentative = 'envoyee', chemin: string | null = CHEMIN): Tentative {
  return {
    id: ID,
    utilisateur_id: UTILISATEUR,
    type: 'diagnostic',
    etape_id: null,
    enregistre_le: new Date('2026-09-06T10:00:00Z'),
    fuseau_horaire: 'Europe/Paris',
    decalage_minutes: 120,
    duree_s: 30,
    chemin_audio: chemin,
    statut,
    resultat: null,
    essais_techniques: 0,
    derniere_erreur: null,
    audio_supprime_le: null,
    cree_le: new Date(),
    modifie_le: new Date(),
  }
}

const MESURES = { version: 1, duree_totale_s: 30 } as unknown as Mesures
const TRANSCRIPTION: Transcription = {
  texte: 'bonjour',
  mots: [{ mot: 'bonjour', debut_s: 1, fin_s: 1.4, confiance: 0.9 }],
}

interface Faux {
  deps: DependancesAnalyse
  journal: string[]
  ecrits: { analyse?: NouvelleAnalyse; evaluation?: NouvelleEvaluation }
}

function construireFaux(
  options: {
    tentative?: Tentative | null
    grille?: GrillePubliee | null
    echouerA?: 'telecharger' | 'transcrire' | 'decoder' | 'enregistrer' | 'supprimer'
  } = {},
): Faux {
  const journal: string[] = []
  const ecrits: Faux['ecrits'] = {}
  const echec = (etape: string) => {
    if (options.echouerA === etape) throw new Error(`panne ${etape}`)
  }
  const depot: DepotAnalyse = {
    lireTentative: async () => (options.tentative === undefined ? tentative() : options.tentative),
    mettreAJourStatut: async (_id, statut) => {
      journal.push(`statut:${statut}`)
    },
    mettreAJourDuree: async (_id, dureeS) => {
      journal.push(`duree:${dureeS}`)
    },
    lireGrillePubliee: async () => options.grille ?? null,
    lireMotsBequilles: async () => ['euh'],
    enregistrerAnalyseEtEvaluation: async (analyse, evaluation) => {
      echec('enregistrer')
      ecrits.analyse = analyse
      ecrits.evaluation = evaluation
      journal.push('ecriture')
      return null
    },
    enregistrerCheminPublic: async (_id, chemin) => {
      journal.push(`copie_publique:${chemin}`)
    },
    marquerAudioSupprime: async () => {
      journal.push('statut:audio_supprime')
    },
    marquerEchecTechnique: async (_id, erreur) => {
      journal.push(`echec_technique:${erreur}`)
    },
    marquerAbandonTechnique: async (_id, audioSupprime) => {
      journal.push(`abandon_technique:${audioSupprime}`)
    },
  }
  const deps: DependancesAnalyse = {
    depot,
    notifier: async () => {
      journal.push('notification')
    },
    stockage: {
      telecharger: async () => {
        echec('telecharger')
        journal.push('telechargement')
        return Buffer.from([1, 2, 3, 4])
      },
      copierVersPublic: async (chemin) => {
        journal.push('televersement_public')
        return chemin
      },
      supprimer: async () => {
        echec('supprimer')
        journal.push('suppression_audio')
      },
    },
    transcripteur: {
      nom: 'faux',
      transcrire: async () => {
        echec('transcrire')
        return TRANSCRIPTION
      },
    },
    decoder: async () => {
      echec('decoder')
      return { pcm: new Float32Array(16000), frequenceHz: 16000, dureeS: 1 }
    },
    prosodie: { extraire: async () => ({ pas_s: 0.01, f0_hz: [null], intensite_db: [null] }) },
    mesurer: () => MESURES,
    evaluerRegle: (regle) => ({ score: 7, max: regle.score_max }),
  }
  return { deps, journal, ecrits }
}

describe('analyserTentative', () => {
  it('follows the state diagram: transcription, mesure, evaluation, write, delete audio, retour', async () => {
    const faux = construireFaux()
    const resultat = await analyserTentative(faux.deps, ID, { log, dernierEssai: false })
    expect(resultat).toBe('analysee')
    expect(faux.journal).toEqual([
      'statut:en_transcription',
      'telechargement',
      'statut:en_mesure',
      'duree:1',
      'statut:en_evaluation',
      'ecriture',
      'suppression_audio',
      'statut:audio_supprime',
      'statut:retour_disponible',
      'notification',
    ])
    expect(faux.ecrits.analyse?.fournisseur_transcription).toBe('faux')
    expect(faux.ecrits.evaluation?.note_totale).toBeNull()
    expect(faux.ecrits.evaluation?.sous_notes).toEqual({})
  })

  it('deletes the audio only after the evaluation is committed', async () => {
    const faux = construireFaux({ echouerA: 'enregistrer' })
    await expect(analyserTentative(faux.deps, ID, { log, dernierEssai: false })).rejects.toThrow(
      'panne enregistrer',
    )
    expect(faux.journal).not.toContain('suppression_audio')
    expect(faux.journal.some((l) => l.startsWith('echec_technique:'))).toBe(true)
    expect(faux.journal.some((l) => l.startsWith('abandon_technique'))).toBe(false)
  })

  it('on the last try, deletes the audio and records the abandon', async () => {
    const faux = construireFaux({ echouerA: 'transcrire' })
    await expect(analyserTentative(faux.deps, ID, { log, dernierEssai: true })).rejects.toThrow(
      'panne transcrire',
    )
    expect(faux.journal).toContain('suppression_audio')
    expect(faux.journal).toContain('abandon_technique:true')
  })

  it('leaves the sweep to clean up when deletion itself fails on the last try', async () => {
    const faux = construireFaux({ echouerA: 'supprimer' })
    await expect(analyserTentative(faux.deps, ID, { log, dernierEssai: true })).rejects.toThrow(
      'panne supprimer',
    )
    expect(faux.journal).toContain('ecriture')
    expect(faux.journal).toContain('abandon_technique:false')
  })

  it('finishes a run that died between audio deletion and the final status', async () => {
    const faux = construireFaux({ tentative: tentative('audio_supprime', null) })
    expect(await analyserTentative(faux.deps, ID, { log, dernierEssai: false })).toBe(
      'reprise_apres_suppression',
    )
    expect(faux.journal).toEqual(['statut:retour_disponible'])
  })

  it('ignores a tentative that is gone or already done', async () => {
    expect(
      await analyserTentative(construireFaux({ tentative: null }).deps, ID, {
        log,
        dernierEssai: false,
      }),
    ).toBe('introuvable')
    const faite = construireFaux({ tentative: tentative('retour_disponible', null) })
    expect(await analyserTentative(faite.deps, ID, { log, dernierEssai: false })).toBe(
      'deja_traitee',
    )
    expect(faite.journal).toEqual([])
  })

  it('scores every criterion of a published grid', async () => {
    const grille: GrillePubliee = {
      id: '2b2b2b2b-2b2b-4b2b-8b2b-2b2b2b2b2b2b',
      version: 3,
      publiee_le: new Date(),
      criteres: [
        {
          id: 'a',
          grille_id: 'g',
          cle: 'rythme',
          nom: 'Rythme',
          definition: '',
          ordre: 0,
          regle: { version: 1, score_max: 10, elements: [] },
        },
        {
          id: 'b',
          grille_id: 'g',
          cle: 'silence',
          nom: 'Silence',
          definition: '',
          ordre: 1,
          regle: { version: 1, score_max: 5, elements: [] },
        },
      ],
    }
    const evaluation = construireEvaluation(ID, grille, MESURES, (regle) => ({
      score: regle.score_max / 2,
      max: regle.score_max,
    }))
    expect(evaluation.version_grille).toBe(3)
    expect(evaluation.sous_notes).toEqual({
      rythme: { score: 5, max: 10 },
      silence: { score: 2.5, max: 5 },
    })
    expect(evaluation.note_totale).toBe(7.5)
  })
})

// The exception of chapter 2: an Arena or duel take stays online for the time of the contest.
// Without the copy, `publier_prise` had nothing to publish and every public take was silent.
describe('la copie publique', () => {
  it("garde une copie d'une prise d'Arène avant de supprimer la privée", async () => {
    const faux = construireFaux({ tentative: { ...tentative(), type: 'arene' } })
    await analyserTentative(faux.deps, ID, { log, dernierEssai: false })
    const i = faux.journal.indexOf('televersement_public')
    const j = faux.journal.indexOf('suppression_audio')
    expect(i).toBeGreaterThan(-1)
    expect(faux.journal).toContain(`copie_publique:${CHEMIN}`)
    expect(i).toBeLessThan(j)
  })

  it('garde une copie pour un duel aussi', async () => {
    const faux = construireFaux({ tentative: { ...tentative(), type: 'duel' } })
    await analyserTentative(faux.deps, ID, { log, dernierEssai: false })
    expect(faux.journal).toContain('televersement_public')
  })

  it("n'en garde aucune pour un diagnostic ni pour une étape", async () => {
    for (const type of ['diagnostic', 'etape'] as const) {
      const faux = construireFaux({ tentative: { ...tentative(), type } })
      await analyserTentative(faux.deps, ID, { log, dernierEssai: false })
      expect(faux.journal).not.toContain('televersement_public')
    }
  })
})
