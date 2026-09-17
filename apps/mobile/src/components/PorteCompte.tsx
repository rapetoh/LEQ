import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text } from 'react-native'

import { Icone } from '@/components/ui/Icone'
import { t } from '@/i18n/fr'
import { versCompte, type RaisonCompte } from '@/services/compte'
import { useTheme } from '@/theme/ThemeProvider'
import { couleurs, polices } from '@/theme/tokens'

// The small line under a door that needs an account, shown only to a person who has none: a
// lock and « Avec un compte », so the door says what it asks before it is tapped rather than
// refusing at the last screen. Tapping the line opens the account screen with the reason.

export function PorteCompte({
  raison,
  surFondSombre = false,
}: {
  raison: RaisonCompte
  surFondSombre?: boolean
}) {
  const theme = useTheme()
  const router = useRouter()
  const couleur = surFondSombre ? couleurs.encre3 : theme.texteTertiaire
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('compte.avecUnCompte')}
      onPress={() => router.push(versCompte(raison))}
      hitSlop={8}
      style={({ pressed }) => [styles.ligne, pressed && { opacity: 0.7 }]}
    >
      <Icone sf="lock.fill" material="lock" taille={12} couleur={couleur} />
      <Text style={[styles.texte, { color: couleur }]}>{t('compte.avecUnCompte')}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'center',
    paddingVertical: 4,
  },
  texte: { fontFamily: polices.semiBold, fontSize: 12.5, lineHeight: 16 },
})
