// The two gestures on an account that undo something: leaving it, and deleting it. Both are
// offered from « Mon compte » and from Réglages, and both have to leave the phone in the same
// state, so they live here once.
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { QueryClient } from '@tanstack/react-query'

import { file } from './prises'
import { supabase, useSession } from './supabase'

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

/**
 * The doors that need an account, and why. A person without one is told at the door, in one
 * sentence, and taken to the account screen; the database refuses anyway, but nobody should
 * reach that refusal after three screens.
 */
export const RAISONS_COMPTE = [
  'arene',
  'vote',
  'duel',
  'boutique',
  'debat',
  'donnees',
  'parcours',
] as const
export type RaisonCompte = (typeof RAISONS_COMPTE)[number]

export function estRaisonCompte(valeur: unknown): valeur is RaisonCompte {
  return typeof valeur === 'string' && (RAISONS_COMPTE as readonly string[]).includes(valeur)
}

/** True for a session opened without an account (the anonymous sign-in of the diagnostic). */
export function useEstAnonyme(): boolean {
  const { session } = useSession()
  return session?.user.is_anonymous === true
}

/** Where a gated door sends a person without an account. */
export function versCompte(raison: RaisonCompte) {
  return { pathname: '/accueil/compte', params: { raison } } as const
}
