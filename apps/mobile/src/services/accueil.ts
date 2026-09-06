// The three onboarding answers, kept on the phone until the take starts and sent
// once the person has a session (anonymous included).
import { NouvellesReponsesAccueilSchema, type NouvellesReponsesAccueil } from '@leq/domaine'

import { supabase } from './supabase'

export type ReponsesLocales = Omit<NouvellesReponsesAccueil, 'utilisateur_id'>

export async function enregistrerReponsesAccueil(
  utilisateurId: string,
  reponses: ReponsesLocales,
): Promise<void> {
  const ligne = NouvellesReponsesAccueilSchema.parse({ utilisateur_id: utilisateurId, ...reponses })
  const { error } = await supabase
    .from('reponses_accueil')
    .upsert(ligne, { onConflict: 'utilisateur_id' })
  if (error) throw new Error(`Réponses non enregistrées : ${error.message}`)
}
