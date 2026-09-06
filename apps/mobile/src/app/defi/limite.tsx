import { useRouter } from 'expo-router'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Bulle } from '@/components/Bulle'
import { Bouton } from '@/components/ui/Bouton'
import { Carte } from '@/components/ui/Carte'
import { Titre } from '@/components/ui/Titre'
import { t } from '@/i18n/fr'
import { useDrapeaux } from '@/services/configuration'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, rayons, typographie } from '@/theme/tokens'

// H5 · Le défi du jour est fait, and H5b when the Arena is off. The limit is told as a
// full day, never as a punishment. The Complet door is there, discreet; the offers
// screen (E1) arrives with Phase 5, so the card is information for now.

export default function Limite() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const drapeaux = useDrapeaux()
  const areneActive = drapeaux.data?.arene === true

  return (
    <ScrollView
      style={{ backgroundColor: theme.fond }}
      contentContainerStyle={[
        styles.contenu,
        { paddingTop: insets.top + espaces.xl, paddingBottom: insets.bottom + espaces.xl },
      ]}
    >
      <View style={styles.centre}>
        <Bulle taille="moyenne" />
        <Titre niveau="ecran" centre>
          {t('defi.termine.titre')}
        </Titre>
        <Text style={[typographie.corps, styles.texteCentre, { color: theme.texteSecondaire }]}>
          {t('defi.termine.corps')}
        </Text>
      </View>

      <Carte teinte="orange" style={styles.bloc}>
        <View style={styles.ligne}>
          <Text style={[typographie.titreCarte, { color: theme.texte, flex: 1 }]}>
            {t('defi.termine.enchainer')}
          </Text>
          <View style={[styles.puce, { backgroundColor: theme.carte }]}>
            <Text style={[typographie.etiquette, { color: theme.texteSecondaire }]}>
              {t('commun.bientot')}
            </Text>
          </View>
        </View>
        <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
          {t('defi.termine.enchainerDetail')}
        </Text>
      </Carte>

      <Carte teinte="douce" style={styles.bloc}>
        <Text style={[typographie.titreCarte, { color: theme.texte }]}>
          {areneActive ? t('defi.termine.enAttendantArene') : t('defi.termine.enAttendant')}
        </Text>
        <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
          {areneActive
            ? t('defi.termine.enAttendantAreneDetail')
            : t('defi.termine.enAttendantDetail')}
        </Text>
      </Carte>

      <View style={styles.actions}>
        {areneActive ? (
          <Bouton
            libelle={t('defi.termine.voirArene')}
            onPress={() => router.replace('/(onglets)/arene')}
          />
        ) : (
          <Bouton
            libelle={t('defi.termine.voirProgres')}
            onPress={() => router.replace('/(onglets)/progres')}
          />
        )}
        <Bouton libelle={t('commun.retour')} variante="texte" onPress={() => router.back()} />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  contenu: { flexGrow: 1, paddingHorizontal: espaces.xl, gap: espaces.m },
  centre: { alignItems: 'center', gap: espaces.m, marginBottom: espaces.s },
  texteCentre: { textAlign: 'center' },
  bloc: { gap: espaces.xs },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espaces.s },
  puce: {
    paddingHorizontal: espaces.xs,
    paddingVertical: espaces.xxs,
    borderRadius: rayons.pilule,
  },
  actions: { marginTop: 'auto', gap: espaces.s, paddingTop: espaces.l },
})
