// openai: the HTTP integration is written in Phase 2, when the key arrives, against the
// provider documentation of that day. Until then the adapter only declares its fiche and
// refuses to run without a key, so the bench never pretends to have measured it.
import type { Transcripteur } from '../../../src/transcripteur.js'
import { lireCle, type AdaptateurBench } from './commun.js'

export const adaptateur: AdaptateurBench = {
  fiche: {
    nom: 'openai',
    cout_euros_par_minute: 0.0055,
    traitement_ue: 'non',
    retention:
      'Conservation par défaut 30 jours pour la lutte contre les abus, zéro rétention sur accord entreprise',
    variableCle: 'OPENAI_API_KEY',
  },
  creer(env): Transcripteur {
    lireCle(env, 'openai', 'OPENAI_API_KEY')
    throw new Error(
      "Adaptateur openai pas encore écrit : la clé est là, l'intégration HTTP arrive en Phase 2.",
    )
  },
}
