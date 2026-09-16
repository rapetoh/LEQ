import type { ReactNode } from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'

import { useTheme } from '@/theme/ThemeProvider'
import { couleurs, espaces, rayons, typographie } from '@/theme/tokens'

// The button shapes of the mockup, which draws every tall button as a rounded rectangle of
// radius 18 and never as a pill: the orange action with its glow, the bleu nuit one, the white
// one with a hairline, the outline, the plain text, and the gold one of the celebration. Labels
// are verbs. A mark (Apple, Google) sits left of the label when the button carries one.

export type VarianteBouton = 'principal' | 'secondaire' | 'texte' | 'blanc' | 'or' | 'nuit'

type Props = {
  libelle: string
  onPress: () => void
  variante?: VarianteBouton
  /** On a bleu nuit hero screen the outline and text turn white. */
  surFondSombre?: boolean
  desactive?: boolean
  chargement?: boolean
  accessibilityHint?: string
  /** A mark left of the label: the Apple logo, the Google « G ». */
  icone?: ReactNode
  style?: StyleProp<ViewStyle>
}

// A label stays on one line: a long one shrinks a little (to four fifths) rather than wrapping
// inside a 56 point button, as the mockup never shows a two-line button.
export function Bouton({
  libelle,
  onPress,
  variante = 'principal',
  surFondSombre = false,
  desactive = false,
  chargement = false,
  accessibilityHint,
  icone,
  style,
}: Props) {
  const theme = useTheme()
  const inactif = desactive || chargement

  const couleurTexte =
    variante === 'principal'
      ? theme.accentTexte
      : variante === 'blanc' || variante === 'or'
        ? couleurs.bleuNuit
        : variante === 'nuit'
          ? couleurs.blanc
          : surFondSombre
            ? theme.heroTexte
            : variante === 'texte'
              ? theme.lien
              : theme.texte

  const styleVariante: ViewStyle =
    variante === 'principal'
      ? { backgroundColor: couleurs.orange, ...styles.lueur }
      : variante === 'nuit'
        ? { backgroundColor: couleurs.bleuNuit }
        : variante === 'blanc'
          ? {
              backgroundColor: couleurs.blanc,
              borderWidth: 1.5,
              borderColor: surFondSombre ? couleurs.blanc : theme.bordure,
            }
          : variante === 'or'
            ? { backgroundColor: couleurs.or }
            : variante === 'secondaire'
              ? {
                  backgroundColor: 'transparent',
                  borderWidth: 1.5,
                  borderColor: surFondSombre ? theme.heroBordure : theme.bordure,
                }
              : { backgroundColor: 'transparent', minHeight: 44 }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactif, busy: chargement }}
      {...(accessibilityHint ? { accessibilityHint } : {})}
      disabled={inactif}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styleVariante,
        pressed && styles.presse,
        inactif && styles.inactif,
        style,
      ]}
    >
      {chargement ? (
        <ActivityIndicator color={couleurTexte} />
      ) : icone ? (
        <View style={styles.avecIcone}>
          {icone}
          <Text
            style={[typographie.bouton, { color: couleurTexte }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {libelle}
          </Text>
        </View>
      ) : (
        <Text
          style={[typographie.bouton, { color: couleurTexte }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {libelle}
        </Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    paddingHorizontal: espaces.xl,
    paddingVertical: espaces.s,
    borderRadius: rayons.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avecIcone: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // The mockup's orange glow: 0 10px 24px at 30 percent.
  lueur: Platform.select({
    ios: {
      shadowColor: couleurs.orange,
      shadowOpacity: 0.3,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 10 },
    },
    android: { elevation: 6 },
    default: {},
  }) as ViewStyle,
  presse: { opacity: 0.85 },
  inactif: { opacity: 0.5 },
})
