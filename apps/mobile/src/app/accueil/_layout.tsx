import { Stack } from 'expo-router'

import { useTheme } from '@/theme/ThemeProvider'

export default function AccueilLayout() {
  const theme = useTheme()
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.hero },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="bienvenue" />
      <Stack.Screen name="micro" />
    </Stack>
  )
}
