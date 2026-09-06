import { TranscripteurStub } from '../../../src/transcripteur.js'
import type { AdaptateurBench } from './commun.js'

/** The engine's deterministic fake: proves the harness end to end, measures nothing real. */
export const adaptateur: AdaptateurBench = {
  fiche: {
    nom: 'stub',
    cout_euros_par_minute: 0,
    traitement_ue: 'oui',
    retention: 'aucune (rien ne quitte la machine)',
    variableCle: null,
  },
  creer() {
    return new TranscripteurStub()
  },
}
