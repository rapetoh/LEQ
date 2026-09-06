// Push tokens and the tap on a notification. The daily reminder and the streak alert are
// local notifications and arrive with Phase 5; today only the transactional
// "Ton retour est prêt" comes through Expo's push service.
import { NouveauJetonPushSchema } from '@leq/domaine'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

import { supabase } from './supabase'

const CANAL_ANDROID = 'retours'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
})

function projectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined
  return extra?.eas?.projectId ?? null
}

export type EtatNotifications = 'accorde' | 'refuse' | 'indetermine' | 'indisponible'

/** Current permission, without prompting. `indisponible` on a simulator. */
export async function lireEtatNotifications(): Promise<EtatNotifications> {
  if (!Device.isDevice) return 'indisponible'
  const { status, canAskAgain } = await Notifications.getPermissionsAsync()
  if (status === 'granted') return 'accorde'
  return canAskAgain ? 'indetermine' : 'refuse'
}

/**
 * Asks once (the right moment is "Quitter, on te préviendra" on the waiting screen),
 * then registers the device token for the signed-in user. Every step is best effort:
 * a refusal or a simulator never blocks the flow.
 */
export async function activerNotifications(): Promise<EtatNotifications> {
  if (!Device.isDevice) return 'indisponible'
  let { status } = await Notifications.getPermissionsAsync()
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status
  }
  if (status !== 'granted') return 'refuse'
  await enregistrerJeton()
  return 'accorde'
}

/** Registers (or reactivates) the Expo push token of this device for the current user. */
export async function enregistrerJeton(): Promise<void> {
  if (!Device.isDevice) return
  const id = projectId()
  if (!id) {
    console.warn('notifications: pas de projectId EAS, jeton non demandé')
    return
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CANAL_ANDROID, {
      name: 'Retours et messages',
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  }
  const { data: session } = await supabase.auth.getSession()
  const utilisateurId = session.session?.user.id
  if (!utilisateurId) return
  const jeton = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data
  const ligne = NouveauJetonPushSchema.parse({
    utilisateur_id: utilisateurId,
    jeton,
    plateforme: Platform.OS === 'ios' ? 'ios' : 'android',
  })
  const { error } = await supabase.from('jetons_push').upsert(ligne, { onConflict: 'jeton' })
  if (error) console.warn('notifications: jeton non enregistré', error.message)
}

/** Re-registers silently at startup when the person already said yes. */
export async function rafraichirJeton(): Promise<void> {
  if ((await lireEtatNotifications()) === 'accorde') await enregistrerJeton().catch(() => undefined)
}

export interface CibleNotification {
  tentative_id?: string
}

/** The data carried by a tapped notification, or null. */
export function lireCible(
  reponse: Notifications.NotificationResponse | null,
): CibleNotification | null {
  const data = reponse?.notification.request.content.data as CibleNotification | undefined
  return data && typeof data.tentative_id === 'string' ? { tentative_id: data.tentative_id } : null
}

export function surNotificationTouchee(ecouteur: (cible: CibleNotification) => void): () => void {
  const abonnement = Notifications.addNotificationResponseReceivedListener((reponse) => {
    const cible = lireCible(reponse)
    if (cible) ecouteur(cible)
  })
  void Notifications.getLastNotificationResponseAsync().then((reponse) => {
    const cible = lireCible(reponse)
    if (cible) ecouteur(cible)
  })
  return () => abonnement.remove()
}
