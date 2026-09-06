// The diagnostic result stays on the phone ("Ton profil reste sur ce téléphone en
// attendant", A7) so the person loses nothing by not creating an account yet.
import { MesuresSchema, type Mesures } from '@leq/domaine'

import { ecrireJson, lireJson, CLES } from './stockage'

export interface ProfilLocal {
  tentative_id: string
  enregistre_le: string
  mesures: Mesures
}

export async function lireProfilLocal(): Promise<ProfilLocal | null> {
  const brut = await lireJson<ProfilLocal>(CLES.profilLocal)
  if (!brut) return null
  const mesures = MesuresSchema.safeParse(brut.mesures)
  return mesures.success ? { ...brut, mesures: mesures.data } : null
}

export async function ecrireProfilLocal(profil: ProfilLocal): Promise<void> {
  await ecrireJson(CLES.profilLocal, profil)
}
