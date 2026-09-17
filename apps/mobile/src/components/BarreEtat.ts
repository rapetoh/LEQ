import { useFocusEffect } from 'expo-router'
import { setStatusBarStyle } from 'expo-status-bar'
import { useCallback } from 'react'

import { useTheme } from '@/theme/ThemeProvider'

// A screen on bleu nuit draws the clock, the battery and the signal in white while it has the
// focus, and gives the bar back to the theme when it leaves. The root sets the bar for the warm
// screens; without this, the dark screens hid the phone's own indicators in black on black.

export function useBarreEtatClaire(): void {
  const theme = useTheme()
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light')
      return () => setStatusBarStyle(theme.sombre ? 'light' : 'dark')
    }, [theme.sombre]),
  )
}
