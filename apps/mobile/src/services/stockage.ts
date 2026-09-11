import AsyncStorage from '@react-native-async-storage/async-storage'

// Keys of the phone's local storage. All reads and writes swallow storage failures:
// a missing value must never block the shell.
export const CLES = {
  accueilTermine: 'accueil_termine',
  cacheConfiguration: 'cache_configuration',
  cacheDrapeaux: 'cache_drapeaux',
  modeNuit: 'mode_nuit',
  animationsReduites: 'animations_reduites',
  profilLocal: 'profil_local',
  reponsesAccueil: 'reponses_accueil',
  priseDiagnostic: 'prise_diagnostic',
} as const

export type CleStockage = (typeof CLES)[keyof typeof CLES]

export async function lireJson<T>(cle: CleStockage): Promise<T | null> {
  try {
    const brut = await AsyncStorage.getItem(cle)
    return brut === null ? null : (JSON.parse(brut) as T)
  } catch {
    return null
  }
}

export async function ecrireJson(cle: CleStockage, valeur: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(cle, JSON.stringify(valeur))
  } catch {
    // Storage full or unavailable: the value is only a cache or a convenience.
  }
}

export async function lireBooleen(cle: CleStockage): Promise<boolean> {
  const valeur = await lireJson<unknown>(cle)
  return valeur === true
}

export async function ecrireBooleen(cle: CleStockage, valeur: boolean): Promise<void> {
  await ecrireJson(cle, valeur)
}
