import { Stack } from 'expo-router'

import { useTheme } from '@/theme/ThemeProvider'

export default function AccueilLayout() {
  const theme = useTheme()
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.fond },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="bienvenue" />
      <Stack.Screen name="micro" />
      <Stack.Screen name="questions" />
      <Stack.Screen name="prise" />
      <Stack.Screen name="analyse" options={{ gestureEnabled: false }} />
      <Stack.Screen name="profil" options={{ gestureEnabled: false }} />
      <Stack.Screen name="compte" />
    </Stack>
  )
}
