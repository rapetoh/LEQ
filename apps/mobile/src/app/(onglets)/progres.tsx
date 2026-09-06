import { useRouter } from 'expo-router'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Bulle } from '@/components/Bulle'
import { Bouton } from '@/components/ui/Bouton'
import { Carte } from '@/components/ui/Carte'
import { Icone } from '@/components/ui/Icone'
import { Titre } from '@/components/ui/Titre'
import { t } from '@/i18n/fr'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, rayons, typographie } from '@/theme/tokens'

// X1 · Progrès, the first day. Nothing to show yet, so no zeros: the page says what will
// appear here and offers the one useful thing, a first take. D1 replaces it after the first
// analysed take (Phase 3).
export default function Progres() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  return (
    <ScrollView
      style={{ backgroundColor: theme.fond }}
      contentContainerStyle={[
        styles.contenu,
        { paddingTop: insets.top + espaces.xxl, paddingBottom: insets.bottom + espaces.xl },
      ]}
    >
      <Bulle taille="moyenne" style={styles.bulle} />
      <Titre niveau="ecran" centre>
        {t('progres.vide.titre')}
      </Titre>
      <Text style={[typographie.corps, styles.corps, { color: theme.texteSecondaire }]}>
        {t('progres.vide.corps')}
      </Text>

      <View style={styles.apercus}>
        <Apercu
          libelle={t('progres.vide.apercuDebit')}
          sf="waveform.path.ecg"
          material="show-chart"
        />
        <Apercu
          libelle={t('progres.vide.apercuBequilles')}
          sf="arrow.down.right"
          material="trending-down"
        />
      </View>

      <Bouton
        libelle={t('progres.vide.action')}
        style={styles.action}
        // The first take is the diagnostic (A2 to A4). A3 and A4 arrive in Phase 1; the
        // entry point of that flow already exists.
        onPress={() => router.push('/accueil/micro')}
      />
    </ScrollView>
  )
}

function Apercu({
  libelle,
  sf,
  material,
}: {
  libelle: string
  sf: Parameters<typeof Icone>[0]['sf']
  material: Parameters<typeof Icone>[0]['material']
}) {
  const theme = useTheme()
  return (
    <Carte style={[styles.apercu, { borderColor: theme.bordure }]} teinte="transparente">
      <View style={[styles.apercuIcone, { backgroundColor: theme.voixDoux }]}>
        <Icone sf={sf} material={material} taille={20} couleur={theme.texte} />
      </View>
      <Text style={[typographie.corpsFort, { color: theme.texte, flex: 1 }]}>{libelle}</Text>
    </Carte>
  )
}

const styles = StyleSheet.create({
  contenu: { flexGrow: 1, paddingHorizontal: espaces.xl, alignItems: 'center', gap: espaces.m },
  bulle: { marginBottom: espaces.s },
  corps: { textAlign: 'center', maxWidth: 320 },
  apercus: { alignSelf: 'stretch', gap: espaces.s, marginTop: espaces.l },
  apercu: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaces.m,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  apercuIcone: {
    width: 40,
    height: 40,
    borderRadius: rayons.s,
    alignItems: 'center',
    justifyContent: 'center',
  },
  action: { alignSelf: 'stretch', marginTop: 'auto' },
})
