import {
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'

import { FournisseurDemarrage } from '@/services/configuration'
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
  const { pret: sessionPrete } = useSession()
  const theme = useTheme()

  useEffect(() => {
    if (policesPretes && sessionPrete) void SplashScreen.hideAsync()
  }, [policesPretes, sessionPrete])

  if (!policesPretes) return null

  return (
    <FournisseurDemarrage>
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
      </Stack>
    </FournisseurDemarrage>
  )
}
