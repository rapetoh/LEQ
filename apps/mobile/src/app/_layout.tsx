import {
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Stack, useRouter } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'

import { FournisseurDemarrage, useConfiguration } from '@/services/configuration'
import { rafraichirJeton, surNotificationTouchee } from '@/services/notifications'
import { definirExpirationFileJours, demarrerFile } from '@/services/prises'
import { FournisseurSession, useSession } from '@/services/supabase'
import { FournisseurTheme, useTheme } from '@/theme/ThemeProvider'

// Keep the native splash until fonts and the session bootstrap are done.
void SplashScreen.preventAutoHideAsync()
SplashScreen.setOptions({ duration: 250, fade: true })

const clientRequetes = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnReconnect: true,
    },
  },
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

  useEffect(() => {
    if (policesPretes && sessionPrete) void SplashScreen.hideAsync()
  }, [policesPretes, sessionPrete])

  // The queue of takes loads once a session exists and sends whatever waits; a push token
  // already granted is re-registered so a deleted token comes back to life.
  useEffect(() => {
    if (!session) return
    void demarrerFile()
    void rafraichirJeton()
  }, [session])

  // A tap on "Ton retour est prêt" opens the take's screen.
  const router = useRouter()
  useEffect(() => {
    return surNotificationTouchee((cible) => {
      if (cible.tentative_id) {
        router.push({ pathname: '/accueil/analyse', params: { id: cible.tentative_id } })
      }
    })
  }, [router])

  if (!policesPretes) return null

  return (
    <FournisseurDemarrage>
      <ReglagesFile />
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
