import * as AppleAuthentication from 'expo-apple-authentication'
import * as Crypto from 'expo-crypto'
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin'
import { Platform } from 'react-native'

import { supabase } from './supabase'

// Sign in with Apple and with Google, natively: the system sheet on the phone, an identity token
// back, and Supabase turns it into a session. No browser, no redirect.
//
// The person arriving here usually holds an anonymous session with a diagnostic on it (A1 to A6).
// The token signs them into the account the identity belongs to, new or existing; the diagnostic
// profile stays on the phone as it always did, and the orphan anonymous user is purged by the
// server after its window, as every anonymous user is. Nothing is moved by hand.

export type Fournisseur = 'apple' | 'google'

export class ErreurIdentite extends Error {
  override name = 'ErreurIdentite'
  constructor(
    readonly raison: 'annule' | 'indisponible' | 'refuse',
    message: string,
  ) {
    super(message)
  }
}

export interface IdentiteObtenue {
  /** What the provider knew of the person's first name, when it gave one. Apple only once. */
  prenom: string | null
}

let googleConfigure = false
function configurerGoogle(): void {
  if (googleConfigure) return
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
    scopes: ['email', 'profile'],
  })
  googleConfigure = true
}

/** Apple exists on iOS only; Google needs its ids, which the build carries. */
export function fournisseurDisponible(fournisseur: Fournisseur): boolean {
  if (fournisseur === 'apple') return Platform.OS === 'ios'
  return Boolean(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID)
}

export async function seConnecterAvec(fournisseur: Fournisseur): Promise<IdentiteObtenue> {
  return fournisseur === 'apple' ? avecApple() : avecGoogle()
}

async function avecApple(): Promise<IdentiteObtenue> {
  if (!(await AppleAuthentication.isAvailableAsync())) {
    throw new ErreurIdentite('indisponible', 'Apple indisponible')
  }
  // Apple signs the hash of a nonce into the token; Supabase checks the token against the raw
  // one. Without it a captured token could be replayed.
  const nonce = Crypto.randomUUID()
  const nonceHache = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce)
  let reponse: AppleAuthentication.AppleAuthenticationCredential
  try {
    reponse = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: nonceHache,
    })
  } catch (erreur) {
    if ((erreur as { code?: string }).code === 'ERR_REQUEST_CANCELED') {
      throw new ErreurIdentite('annule', 'annulé')
    }
    throw new ErreurIdentite('refuse', messageDe(erreur))
  }
  if (!reponse.identityToken) throw new ErreurIdentite('refuse', 'Apple sans jeton')
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: reponse.identityToken,
    nonce,
  })
  if (error) throw new ErreurIdentite('refuse', error.message)
  return { prenom: reponse.fullName?.givenName?.trim() || null }
}

async function avecGoogle(): Promise<IdentiteObtenue> {
  configurerGoogle()
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
    const resultat = await GoogleSignin.signIn()
    if (resultat.type === 'cancelled') throw new ErreurIdentite('annule', 'annulé')
    const jeton = resultat.data.idToken
    if (!jeton) throw new ErreurIdentite('refuse', 'Google sans jeton')
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: jeton })
    if (error) throw new ErreurIdentite('refuse', error.message)
    return { prenom: resultat.data.user.givenName?.trim() || null }
  } catch (erreur) {
    if (erreur instanceof ErreurIdentite) throw erreur
    const code = (erreur as { code?: string }).code
    if (code === statusCodes.SIGN_IN_CANCELLED) throw new ErreurIdentite('annule', 'annulé')
    if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new ErreurIdentite('indisponible', 'Google indisponible')
    }
    throw new ErreurIdentite('refuse', messageDe(erreur))
  }
}

function messageDe(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : String(erreur)
}
