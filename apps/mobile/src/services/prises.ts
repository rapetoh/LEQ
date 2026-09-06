// The queue of takes with its real dependencies, and the triggers that send it:
// app coming to the foreground, network coming back, a take just finished.
import AsyncStorage from '@react-native-async-storage/async-storage'
import { addNetworkStateListener, getNetworkStateAsync } from 'expo-network'
import { File } from 'expo-file-system'
import { AppState } from 'react-native'

import { FileLocale } from './file'
import type { EntreeFile } from './fileMachine'
import { supabase } from './supabase'
import { televerserPrise } from './tentatives'

const CLE_INDEX = 'leq.file.v1'
const JOURS_EXPIRATION_DEFAUT = 7

let joursExpiration = JOURS_EXPIRATION_DEFAUT

/** Called once the configuration is loaded (`expiration_file_locale_jours`). */
export function definirExpirationFileJours(jours: number): void {
  if (Number.isFinite(jours) && jours > 0) joursExpiration = jours
}

async function utilisateurCourant(): Promise<string> {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const id = data.session?.user.id
  if (!id) throw new Error('Pas de session')
  return id
}

export const file = new FileLocale({
  async lireIndex() {
    try {
      const brut = await AsyncStorage.getItem(CLE_INDEX)
      const entrees: unknown = brut ? JSON.parse(brut) : []
      return Array.isArray(entrees) ? (entrees as EntreeFile[]) : []
    } catch {
      return []
    }
  },
  async ecrireIndex(entrees) {
    await AsyncStorage.setItem(CLE_INDEX, JSON.stringify(entrees))
  },
  async supprimerFichier(chemin) {
    const fichier = new File(chemin)
    if (fichier.exists) fichier.delete()
  },
  async estEnLigne() {
    const etat = await getNetworkStateAsync()
    return etat.isConnected === true && etat.isInternetReachable !== false
  },
  async televerser(entree) {
    await televerserPrise(entree, await utilisateurCourant())
  },
  maintenant: () => new Date(),
  joursExpiration: () => joursExpiration,
})

let declencheursInstalles = false

/** Loads the queue and installs the send triggers. Safe to call more than once. */
export async function demarrerFile(): Promise<void> {
  await file.charger()
  if (declencheursInstalles) return
  declencheursInstalles = true
  AppState.addEventListener('change', (etat) => {
    if (etat === 'active') void file.envoyerEnAttente()
  })
  addNetworkStateListener((etat) => {
    if (etat.isConnected) void file.envoyerEnAttente()
  })
  void file.envoyerEnAttente()
}

/** The time fields of a take, taken on the phone when the person starts speaking. */
export function horodatageLocal(maintenant: Date = new Date()): {
  enregistre_le: Date
  fuseau_horaire: string
  decalage_minutes: number
} {
  let fuseau = 'UTC'
  try {
    fuseau = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    fuseau = 'UTC'
  }
  return {
    enregistre_le: maintenant,
    fuseau_horaire: fuseau,
    decalage_minutes: -maintenant.getTimezoneOffset(),
  }
}
