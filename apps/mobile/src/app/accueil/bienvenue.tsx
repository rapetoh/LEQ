import { useRouter } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Bulle } from '@/components/Bulle'
import { CielEtoile } from '@/components/CielEtoile'
import { Bouton } from '@/components/ui/Bouton'
import { Titre } from '@/components/ui/Titre'
import { t } from '@/i18n/fr'
import { useTheme } from '@/theme/ThemeProvider'
import { couleurs, espaces, polices, typographie } from '@/theme/tokens'

// A1 · Bienvenue. Bleu nuit hero: Bulle greets, one promise, one button. No carousel.
export default function Bienvenue() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  return (
    <View
      style={[
        styles.ecran,
        {
          backgroundColor: theme.hero,
          paddingTop: insets.top + espaces.l,
          paddingBottom: insets.bottom + espaces.l,
        },
      ]}
    >
      <CielEtoile />

      <View style={styles.marque} accessibilityRole="header" accessibilityLabel={t('marque')}>
        <Text style={[styles.marqueTexte, { color: theme.heroTexte }]}>{t('marque')}</Text>
        <View style={styles.marquePoint} />
      </View>

      <View style={styles.centre}>
        <Bulle taille="grande" />
        <Titre niveau="hero" surFondSombre centre style={styles.titre}>
          {t('accueil.bienvenue.titre')}
        </Titre>
        <Text style={[typographie.corps, styles.sousTitre, { color: theme.heroTexteSecondaire }]}>
          {t('accueil.bienvenue.sousTitre')}
        </Text>
      </View>

      <View style={styles.actions}>
        <Bouton
          libelle={t('accueil.bienvenue.commencer')}
          onPress={() => router.push('/accueil/micro')}
        />
        <Bouton
          libelle={t('accueil.bienvenue.dejaUnCompte')}
          variante="secondaire"
          surFondSombre
          onPress={() => router.push('/accueil/compte?mode=connexion')}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  ecran: { flex: 1, paddingHorizontal: espaces.xl },
  marque: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  marqueTexte: { fontFamily: polices.extraBold, fontSize: 24, lineHeight: 28, letterSpacing: 1 },
  marquePoint: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: couleurs.orange,
    marginBottom: 4,
  },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: espaces.l },
  titre: { marginTop: espaces.m },
  sousTitre: { textAlign: 'center', maxWidth: 320 },
  actions: { gap: espaces.s },
})
