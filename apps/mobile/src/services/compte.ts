// The two gestures on an account that undo something: leaving it, and deleting it. Both are
// offered from « Mon compte » and from Réglages, and both have to leave the phone in the same
// state, so they live here once.
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { QueryClient } from '@tanstack/react-query'

import { file } from './prises'
import { supabase } from './supabase'

/** Signs out; the caller then re-bootstraps the session, which opens an anonymous one. */
export async function seDeconnecter(clientRequetes: QueryClient): Promise<void> {
  await supabase.auth.signOut()
  clientRequetes.clear()
}

/**
 * Asks the server to delete the account (rows and audio, as a job), then makes the phone forget
 * everything it held: the queue of takes, the local profile, the caches. Throws when the server
 * refused; the caller says so and leaves the account alone.
 */
export async function supprimerCompteEtToutOublier(clientRequetes: QueryClient): Promise<void> {
  const { error } = await supabase.rpc('demander_suppression_compte')
  if (error) throw new Error(error.message)
  for (const entree of file.lire()) {
    if (entree.chemin) await file.annuler(entree.id).catch(() => undefined)
  }
  await supabase.auth.signOut()
  await AsyncStorage.clear()
  clientRequetes.clear()
}
