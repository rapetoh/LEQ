import { useLocalSearchParams, useRouter } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Bulle } from '@/components/Bulle'
import { EcranChargement, EcranErreur } from '@/components/EcransEtat'
import { Bouton } from '@/components/ui/Bouton'
import { Titre } from '@/components/ui/Titre'
import { t } from '@/i18n/fr'
import { useCarte } from '@/services/parcours'
import { chiffreRomain } from '@/services/rythme'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, typographie } from '@/theme/tokens'

// H3 · L'acte traversé. Replaces H2 when the last défi of an act is validated: the act
// turns gold, Bulle celebrates, the next land shows itself. Sober, adult. The act's own
// closing line is content (Rebecca); until then the screen counts what was done.

export default function ActeTraverse() {
  const params = useLocalSearchParams<{ acteId?: string }>()
  const acteId = typeof params.acteId === 'string' ? params.acteId : null
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const carte = useCarte()

  if (carte.isPending) return <EcranChargement />
  if (carte.isError) {
    return <EcranErreur message={carte.error.message} reessayer={() => void carte.refetch()} />
  }
  const acte = carte.data.find((a) => a.id === acteId)
  if (!acte) {
    return <EcranErreur message={t('carte.introuvable')} reessayer={() => router.back()} />
  }
  const suivant = carte.data.find((a) => a.ordre === acte.ordre + 1) ?? null
  const nb = acte.etapes.length

  return (
    <View
      style={[
        styles.ecran,
        {
          backgroundColor: theme.hero,
          paddingTop: insets.top + espaces.xxl,
          paddingBottom: insets.bottom + espaces.xl,
        },
      ]}
    >
      <View style={styles.centre}>
        <Bulle taille="grande" />
        <Text style={[typographie.etiquette, { color: theme.voix }]}>
          {t('defi.acteTraverse.surtitre', { acte: chiffreRomain(acte.ordre) })}
        </Text>
        <Titre niveau="hero" surFondSombre centre>
          {acte.titre}
        </Titre>
        <Text style={[typographie.corps, styles.texteCentre, { color: theme.heroTexteSecondaire }]}>
          {nb === 1 ? t('defi.acteTraverse.corpsUn') : t('defi.acteTraverse.corps', { nb })}
        </Text>
        {!suivant ? (
          <Text
            style={[typographie.corps, styles.texteCentre, { color: theme.heroTexteSecondaire }]}
          >
            {t('defi.acteTraverse.fin')}
          </Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        {suivant ? (
          <Bouton
            libelle={t('defi.acteTraverse.decouvrir', {
              acte: chiffreRomain(suivant.ordre),
              titre: suivant.titre,
            })}
            onPress={() => router.replace('/(onglets)/defis')}
          />
        ) : (
          <Bouton
            libelle={t('defi.resultat.carte')}
            onPress={() => router.replace('/(onglets)/defis')}
          />
        )}
        <Bouton
          libelle={t('defi.acteTraverse.plusTard')}
          variante="texte"
          surFondSombre
          onPress={() => router.replace('/(onglets)/aujourdhui')}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  ecran: { flex: 1, paddingHorizontal: espaces.xl, justifyContent: 'space-between' },
  centre: { alignItems: 'center', gap: espaces.m, flex: 1, justifyContent: 'center' },
  texteCentre: { textAlign: 'center' },
  actions: { gap: espaces.s },
})
