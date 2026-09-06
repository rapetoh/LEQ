import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native'

import { useTheme } from '@/theme/ThemeProvider'
import { couleurs, espaces, rayons, typographie } from '@/theme/tokens'

// The three button shapes of the mockup: orange pill, outline, plain text. Labels are verbs.

export type VarianteBouton = 'principal' | 'secondaire' | 'texte'

type Props = {
  libelle: string
  onPress: () => void
  variante?: VarianteBouton
  /** On a bleu nuit hero screen the outline and text turn white. */
  surFondSombre?: boolean
  desactive?: boolean
  chargement?: boolean
  accessibilityHint?: string
  style?: StyleProp<ViewStyle>
}

export function Bouton({
  libelle,
  onPress,
  variante = 'principal',
  surFondSombre = false,
  desactive = false,
  chargement = false,
  accessibilityHint,
  style,
}: Props) {
  const theme = useTheme()
  const inactif = desactive || chargement

  const couleurTexte =
    variante === 'principal'
      ? theme.accentTexte
      : surFondSombre
        ? theme.heroTexte
        : variante === 'texte'
          ? theme.lien
          : theme.texte

  const styleVariante: ViewStyle =
    variante === 'principal'
      ? { backgroundColor: couleurs.orange }
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
      ) : (
        <Text style={[typographie.bouton, { color: couleurTexte }]}>{libelle}</Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    paddingHorizontal: espaces.xl,
    paddingVertical: espaces.s,
    borderRadius: rayons.pilule,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presse: { opacity: 0.85 },
  inactif: { opacity: 0.5 },
})
