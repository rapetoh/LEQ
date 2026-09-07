// The person's timezone, written on their profile so the database computes "today" (streak,
// rhythm, progress) in their own day and not in Paris. Best effort, once per session start.
import { IanaTimezoneSchema } from '@leq/domaine'

import { supabase } from './supabase'

export function fuseauDuTelephone(): string | null {
  try {
    const lu = IanaTimezoneSchema.safeParse(Intl.DateTimeFormat().resolvedOptions().timeZone)
    return lu.success ? lu.data : null
  } catch {
    return null
  }
}

/** Writes the phone's zone when the profile holds another one (or none). */
export async function synchroniserFuseau(utilisateurId: string): Promise<void> {
  const fuseau = fuseauDuTelephone()
  if (!fuseau) return
  try {
    const { data } = await supabase
      .from('profils')
      .select('fuseau_horaire')
      .eq('id', utilisateurId)
      .maybeSingle()
    if ((data as { fuseau_horaire?: string | null } | null)?.fuseau_horaire === fuseau) return
    await supabase.from('profils').update({ fuseau_horaire: fuseau }).eq('id', utilisateurId)
  } catch (erreur) {
    console.warn('fuseau: profil non mis à jour', erreur)
  }
}
