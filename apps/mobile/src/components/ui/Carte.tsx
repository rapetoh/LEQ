import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import type { ReactNode } from 'react'

import { useTheme } from '@/theme/ThemeProvider'
import { espaces, rayons } from '@/theme/tokens'

export type TeinteCarte = 'carte' | 'douce' | 'orange' | 'voix' | 'transparente'

type Props = {
  children: ReactNode
  teinte?: TeinteCarte
  style?: StyleProp<ViewStyle>
}

export function Carte({ children, teinte = 'carte', style }: Props) {
  const theme = useTheme()
  const fond =
    teinte === 'douce'
      ? theme.carteDouce
      : teinte === 'orange'
        ? theme.accentDoux
        : teinte === 'voix'
          ? theme.voixDoux
          : teinte === 'transparente'
            ? 'transparent'
            : theme.carte

  return (
    <View
      style={[
        styles.carte,
        { backgroundColor: fond },
        teinte === 'carte' && !theme.sombre && styles.ombre,
        style,
      ]}
    >
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  carte: {
    borderRadius: rayons.xxl,
    padding: espaces.l,
  },
  ombre: Platform.select({
    ios: {
      shadowColor: '#001636',
      shadowOpacity: 0.06,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
    },
    android: { elevation: 1 },
    default: {},
  }) as ViewStyle,
})
