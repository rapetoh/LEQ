import { useRouter } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { CartePlaceholder } from '@/components/CartePlaceholder'
import { EnteteEcran } from '@/components/EnteteEcran'
import { Carte } from '@/components/ui/Carte'
import { t } from '@/i18n/fr'
import { useDrapeaux } from '@/services/configuration'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, rayons, typographie } from '@/theme/tokens'

// G1 · Moi. The speaker identity first, administration after. Settings live in G3 (/reglages).

export default function Moi() {
  const theme = useTheme()
  const router = useRouter()
  const drapeaux = useDrapeaux()

  const lignes: { libelle: string; action?: () => void }[] = [
    ...(drapeaux.data?.face_a_face === true ? [{ libelle: t('moi.faceAFace') }] : []),
    { libelle: t('moi.mesRecompenses') },
    { libelle: t('moi.monAbonnement') },
    { libelle: t('moi.reglages'), action: () => router.push('/reglages') },
  ]

  return (
    <ScrollView style={{ backgroundColor: theme.fond }} contentContainerStyle={styles.contenu}>
      <EnteteEcran titre={t('moi.titre')} />

      <View style={styles.sections}>
        <CartePlaceholder phrase={t('moi.placeholderProfil')} />

        <Carte style={styles.liste}>
          {lignes.map((ligne, index) => (
            <Pressable
              key={ligne.libelle}
              accessibilityRole={ligne.action ? 'button' : undefined}
              onPress={ligne.action}
              disabled={!ligne.action}
              style={[
                styles.ligne,
                index > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: theme.bordure,
                },
              ]}
            >
              <Text style={[typographie.corpsFort, { color: theme.texte, flex: 1 }]}>
                {ligne.libelle}
              </Text>
              {ligne.action ? (
                <Text style={[typographie.corpsFort, { color: theme.texteTertiaire }]}>›</Text>
              ) : (
                <View style={[styles.puce, { backgroundColor: theme.carteDouce }]}>
                  <Text style={[typographie.etiquette, { color: theme.texteSecondaire }]}>
                    {t('commun.bientot')}
                  </Text>
                </View>
              )}
            </Pressable>
          ))}
        </Carte>

        <Carte teinte="voix">
          <Text style={[typographie.corpsFort, { color: theme.texte }]}>{t('moi.ateliers')}</Text>
        </Carte>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  contenu: { paddingBottom: espaces.xxl },
  sections: { paddingHorizontal: espaces.xl, gap: espaces.l },
  section: { gap: espaces.s },
  liste: { paddingVertical: 0 },
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaces.s,
    paddingVertical: espaces.m,
  },
  sansMarge: { paddingBottom: 0 },
  puce: {
    paddingHorizontal: espaces.xs,
    paddingVertical: espaces.xxs,
    borderRadius: rayons.pilule,
  },
  confort: { gap: espaces.m },
  segments: { flexDirection: 'row', padding: 3, borderRadius: rayons.pilule },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: espaces.xs,
    borderRadius: rayons.pilule,
  },
})
