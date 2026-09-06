import { StyleSheet, Text, View } from 'react-native'

import { Bulle } from '@/components/Bulle'
import { Bouton } from '@/components/ui/Bouton'
import { t } from '@/i18n/fr'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, typographie } from '@/theme/tokens'

// Full-screen states used by the startup gate: Bulle waits, or explains what failed.

export function EcranChargement() {
  const theme = useTheme()
  return (
    <View
      style={[styles.conteneur, { backgroundColor: theme.fond }]}
      accessibilityRole="progressbar"
    >
      <Bulle taille="moyenne" />
      <Text style={[typographie.corps, styles.texte, { color: theme.texteSecondaire }]}>
        {t('commun.chargement')}
      </Text>
    </View>
  )
}

export function EcranErreur({ message, reessayer }: { message: string; reessayer: () => void }) {
  const theme = useTheme()
  return (
    <View style={[styles.conteneur, { backgroundColor: theme.fond }]}>
      <Bulle taille="moyenne" calme />
      <Text style={[typographie.titreSection, styles.texte, { color: theme.texte }]}>
        {t('erreurs.generique')}
      </Text>
      <Text style={[typographie.corps, styles.texte, { color: theme.texteSecondaire }]}>
        {message}
      </Text>
      <Bouton libelle={t('commun.reessayer')} onPress={reessayer} style={styles.bouton} />
    </View>
  )
}

const styles = StyleSheet.create({
  conteneur: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: espaces.xl,
    gap: espaces.m,
  },
  texte: { textAlign: 'center' },
  bouton: { marginTop: espaces.s, alignSelf: 'stretch' },
})
