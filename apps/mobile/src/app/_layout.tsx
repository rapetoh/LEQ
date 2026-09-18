import {
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Stack, useRouter, type ErrorBoundaryProps } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'

import { GardeSuspension } from '@/components/GardeSuspension'
import { Lancement } from '@/components/Lancement'
import { t } from '@/i18n/fr'
import { Rappels } from '@/components/Rappels'
import { FournisseurDemarrage, useConfiguration } from '@/services/configuration'
import { rafraichirJeton, routePourCible, surNotificationTouchee } from '@/services/notifications'
import { definirExpirationFileJours, demarrerFile, routePourRetour } from '@/services/prises'
import { synchroniserFuseau } from '@/services/fuseau'
import { FournisseurSession, useSession } from '@/services/supabase'
import { useIdentiteUsage } from '@/services/usage'
import { FournisseurTheme, useTheme } from '@/theme/ThemeProvider'

// The native launch screen is plain bleu nuit. It stays until the launch overlay (the mark
// writing itself, `Lancement`) has drawn its first frame on the same colour, so the handoff is
// invisible; the overlay then covers the app until fonts and the session are ready.
void SplashScreen.preventAutoHideAsync()
SplashScreen.setOptions({ duration: 120, fade: true })

const clientRequetes = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnReconnect: true,
    },
  },
})

/**
 * An error thrown while a screen renders lands here instead of closing the app. Build 19 closed
 * on the Moi tab because a constructor Hermes does not have threw during render, and the person
 * saw the app vanish. Plain primitives and static colours only: nothing here may depend on a
 * provider that could itself be the thing that failed.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  console.error('écran en échec', error)
  return (
    <View style={stylesErreur.ecran}>
      <Text style={stylesErreur.titre}>{t('erreurs.generique')}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => void retry()}
        style={({ pressed }) => [stylesErreur.bouton, pressed && { opacity: 0.8 }]}
      >
        <Text style={stylesErreur.boutonTexte}>{t('commun.reessayer')}</Text>
      </Pressable>
    </View>
  )
}

const stylesErreur = StyleSheet.create({
  ecran: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 20,
    backgroundColor: '#F7F5F0',
  },
  titre: { fontSize: 18, textAlign: 'center', color: '#001636' },
  bouton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: '#001636',
  },
  boutonTexte: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
})

export default function RacineLayout() {
  const [policesChargees, erreurPolices] = useFonts({
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  })

  // A font failure must not block the app: the system font takes over.
  const policesPretes = policesChargees || erreurPolices !== null

  return (
    <FournisseurSession>
      <QueryClientProvider client={clientRequetes}>
        <FournisseurTheme>
          <Coquille policesPretes={policesPretes} />
        </FournisseurTheme>
      </QueryClientProvider>
    </FournisseurSession>
  )
}

function Coquille({ policesPretes }: { policesPretes: boolean }) {
  const { pret: sessionPrete, session } = useSession()
  const theme = useTheme()
  useIdentiteUsage()
  const [lancement, setLancement] = useState(true)

  // The queue of takes loads once a session exists and sends whatever waits; a push token
  // already granted is re-registered so a deleted token comes back to life.
  useEffect(() => {
    if (!session) return
    void demarrerFile()
    void rafraichirJeton()
    void synchroniserFuseau(session.user.id)
  }, [session])

  // A tap on "Ton retour est prêt" opens the take's waiting screen, which opens the
  // feedback as soon as it is there: A5 for the diagnostic, the step's own screen otherwise.
  const router = useRouter()
  useEffect(() => {
    return surNotificationTouchee((cible) => {
      if (cible.tentative_id) {
        void routePourRetour(cible.tentative_id).then((route) => router.push(route))
        return
      }
      const route = routePourCible(cible)
      if (route) router.push(route)
    })
  }, [router])

  return (
    <View style={styles.racine}>
      {policesPretes ? <Application theme={theme} /> : null}
      {lancement ? (
        <Lancement
          pret={policesPretes && sessionPrete}
          onPremierRendu={() => void SplashScreen.hideAsync()}
          onFin={() => setLancement(false)}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({ racine: { flex: 1, backgroundColor: '#001636' } })

function Application({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <FournisseurDemarrage>
      <ReglagesFile />
      <Rappels />
      <GardeSuspension />
      <StatusBar style={theme.sombre ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.fond },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="accueil" />
        <Stack.Screen name="(onglets)" />
        <Stack.Screen name="reglages" />
        <Stack.Screen name="moi/compte" />
        <Stack.Screen name="defi/[etapeId]/index" />
        <Stack.Screen name="defi/[etapeId]/prise" options={{ gestureEnabled: false }} />
        <Stack.Screen name="defi/[etapeId]/rattrapage" />
        <Stack.Screen name="defi/[etapeId]/exercice" />
        <Stack.Screen name="defi/limite" />
        <Stack.Screen name="arene/prise" options={{ gestureEnabled: false }} />
        <Stack.Screen name="duel/[id]/prise" options={{ gestureEnabled: false }} />
        <Stack.Screen name="analyse/[id]" options={{ gestureEnabled: false }} />
        <Stack.Screen name="retour/[tentativeId]" options={{ gestureEnabled: false }} />
        <Stack.Screen name="acte/[acteId]/index" />
        <Stack.Screen name="acte/[acteId]/traverse" options={{ gestureEnabled: false }} />
        <Stack.Screen name="recompenses" />
        <Stack.Screen name="rebecca" />
        <Stack.Screen name="aujourdhui/rebecca" />
        <Stack.Screen name="suspendu" options={{ gestureEnabled: false }} />
      </Stack>
    </FournisseurDemarrage>
  )
}

/** Passes the configured expiry of the local queue to the queue. */
function ReglagesFile() {
  const configuration = useConfiguration()
  useEffect(() => {
    if (configuration.data)
      definirExpirationFileJours(configuration.data.expiration_file_locale_jours)
  }, [configuration.data])
  return null
}
