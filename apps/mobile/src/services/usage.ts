import { PostHog } from 'posthog-react-native'
import { useEffect } from 'react'

import { useSession } from './supabase'

// What people do in the application, counted: which screens are opened, which gestures are made,
// where the path stops. It is how Rebecca will know whether a challenge works and where people
// leave, and it is the one thing the product cannot tell her from the database alone.
//
// Nothing about the voice goes out: no audio, no transcript, no measure. An event is a name and,
// at most, an identifier of the thing it is about. The key is public by design and ships inside
// the app; without it (a developer's machine, a test) every call is a no-op.

const CLE = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? ''
const HOTE = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com'

export const posthog: PostHog | null = CLE
  ? new PostHog(CLE, {
      host: HOTE,
      // A batch every ten seconds or every twenty events, whichever comes first: the phone is
      // not a dashboard, and the network is not free.
      flushAt: 20,
      flushInterval: 10_000,
      // Screens are counted by hand from the router, with French names.
      captureAppLifecycleEvents: true,
    })
  : null

/** The events the product counts. A closed list, so a typo never becomes a metric. */
export type EvenementUsage =
  | 'accueil_commence'
  | 'compte_connexion'
  | 'defi_ouvert'
  | 'prise_enregistree'
  | 'retour_ouvert'
  | 'defi_valide'
  | 'arene_prise_publiee'
  | 'arene_vote'
  | 'duel_cree'
  | 'debat_ouvert'
  | 'debat_termine'
  | 'recompense_echangee'

export function compter(
  evenement: EvenementUsage,
  proprietes?: Record<string, string | number | boolean>,
): void {
  posthog?.capture(evenement, proprietes)
}

/** One screen opened, by its route name. */
export function compterEcran(nom: string): void {
  posthog?.screen(nom)
}

/**
 * Ties the events to the person, and forgets them when the session goes. An anonymous session
 * counts as a person too: the diagnostic is the most important funnel of all, and it happens
 * before any account exists.
 */
export function useIdentiteUsage(): void {
  const { session } = useSession()
  useEffect(() => {
    if (!posthog) return
    if (session) {
      posthog.identify(session.user.id, { anonyme: session.user.is_anonymous === true })
    } else {
      posthog.reset()
    }
  }, [session])
}
