// gladia: the HTTP integration is written in Phase 2, when the key arrives, against the
// provider documentation of that day. Until then the adapter only declares its fiche and
// refuses to run without a key, so the bench never pretends to have measured it.
import type { Transcripteur } from '../../../src/transcripteur.js'
import { lireCle, type AdaptateurBench } from './commun.js'

export const adaptateur: AdaptateurBench = {
  fiche: {
    nom: 'gladia',
    cout_euros_par_minute: 0.0102,
    traitement_ue: 'oui',
    retention:
      'Entreprise française, traitement en Europe, suppression après traitement configurable',
    variableCle: 'GLADIA_API_KEY',
  },
  creer(env): Transcripteur {
    lireCle(env, 'gladia', 'GLADIA_API_KEY')
    throw new Error(
      "Adaptateur gladia pas encore écrit : la clé est là, l'intégration HTTP arrive en Phase 2.",
    )
  },
}
