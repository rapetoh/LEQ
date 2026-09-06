import { useRouter } from 'expo-router'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { CartePlaceholder } from '@/components/CartePlaceholder'
import { Bouton } from '@/components/ui/Bouton'
import { Carte } from '@/components/ui/Carte'
import { Titre } from '@/components/ui/Titre'
import { t } from '@/i18n/fr'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, typographie } from '@/theme/tokens'

// F1 · Le pont vers Rebecca. Reached from a victory or from G1, never by a popup. The
// workshops arrive with Phase 6 (announcements); until then the card says so.

export default function Rebecca() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  return (
    <ScrollView
      style={{ backgroundColor: theme.fond }}
      contentContainerStyle={[
        styles.contenu,
        { paddingTop: insets.top + espaces.xl, paddingBottom: insets.bottom + espaces.xl },
      ]}
    >
      <Titre niveau="ecran">{t('rebecca.titre')}</Titre>
      <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
        {t('rebecca.corps')}
      </Text>

      <CartePlaceholder titre={t('rebecca.ateliers')} phrase={t('rebecca.ateliersPlaceholder')} />

      <Carte style={styles.bloc}>
        <Text style={[typographie.titreCarte, { color: theme.texte }]}>
          {t('rebecca.individuel')}
        </Text>
        <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
          {t('rebecca.individuelDetail')}
        </Text>
      </Carte>

      <View style={styles.actions}>
        <Bouton
          libelle={t('rebecca.voirRecompenses')}
          variante="secondaire"
          onPress={() => router.push('/recompenses')}
        />
        <Bouton libelle={t('rebecca.plusTard')} variante="texte" onPress={() => router.back()} />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  contenu: { flexGrow: 1, paddingHorizontal: espaces.xl, gap: espaces.m },
  bloc: { gap: espaces.xs },
  actions: { marginTop: 'auto', gap: espaces.s, paddingTop: espaces.l },
})
