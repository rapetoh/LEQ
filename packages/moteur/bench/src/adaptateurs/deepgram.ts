// deepgram: the HTTP integration is written in Phase 2, when the key arrives, against the
// provider documentation of that day. Until then the adapter only declares its fiche and
// refuses to run without a key, so the bench never pretends to have measured it.
import type { Transcripteur } from '../../../src/transcripteur.js'
import { lireCle, type AdaptateurBench } from './commun.js'

export const adaptateur: AdaptateurBench = {
  fiche: {
    nom: 'deepgram',
    cout_euros_par_minute: 0.0037,
    traitement_ue: 'oui',
    retention: 'Configurable par projet, suppression sur demande',
    variableCle: 'DEEPGRAM_API_KEY',
  },
  creer(env): Transcripteur {
    lireCle(env, 'deepgram', 'DEEPGRAM_API_KEY')
    throw new Error(
      "Adaptateur deepgram pas encore écrit : la clé est là, l'intégration HTTP arrive en Phase 2.",
    )
  },
}
