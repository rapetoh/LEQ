import { useRouter } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Bulle } from '@/components/Bulle'
import { Bouton } from '@/components/ui/Bouton'
import { Titre } from '@/components/ui/Titre'
import { t } from '@/i18n/fr'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, typographie } from '@/theme/tokens'

// A suspended account (cahier chapter 8) sees one screen: what it means, and the two gestures
// that stay open, in the settings (copy of the data, deletion).
export default function Suspendu() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  return (
    <View
      style={[
        styles.ecran,
        {
          backgroundColor: theme.fond,
          paddingTop: insets.top + espaces.xxl,
          paddingBottom: insets.bottom + espaces.xl,
        },
      ]}
    >
      <View style={styles.centre}>
        <Bulle taille="moyenne" calme />
        <Titre niveau="ecran" centre>
          {t('suspendu.titre')}
        </Titre>
        <Text style={[typographie.corps, styles.texte, { color: theme.texteSecondaire }]}>
          {t('suspendu.corps')}
        </Text>
      </View>
      <Bouton
        libelle={t('suspendu.reglages')}
        variante="secondaire"
        onPress={() => router.push('/reglages')}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  ecran: { flex: 1, paddingHorizontal: espaces.xl, justifyContent: 'space-between' },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: espaces.m },
  texte: { textAlign: 'center' },
})
