import { ScrollView, StyleSheet, View } from 'react-native'

import { CartePlaceholder } from '@/components/CartePlaceholder'
import { EnteteEcran } from '@/components/EnteteEcran'
import { t } from '@/i18n/fr'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces } from '@/theme/tokens'

// H1 · Défis, the map of acts. The path machinery is Phase 4.
export default function Defis() {
  const theme = useTheme()
  return (
    <ScrollView style={{ backgroundColor: theme.fond }} contentContainerStyle={styles.contenu}>
      <EnteteEcran titre={t('defis.titre')} />
      <View style={styles.sections}>
        <CartePlaceholder phrase={t('defis.placeholder')} />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  contenu: { paddingBottom: espaces.xxl },
  sections: { paddingHorizontal: espaces.xl, gap: espaces.l },
})
