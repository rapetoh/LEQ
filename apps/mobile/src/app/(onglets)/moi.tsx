import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'

import { CartePlaceholder } from '@/components/CartePlaceholder'
import { EnteteEcran } from '@/components/EnteteEcran'
import { Carte } from '@/components/ui/Carte'
import { Titre } from '@/components/ui/Titre'
import { t } from '@/i18n/fr'
import { useDrapeaux } from '@/services/configuration'
import { useContexteTheme, type ModeNuit } from '@/theme/ThemeProvider'
import { espaces, rayons, typographie } from '@/theme/tokens'

// G1 · Moi. The speaker identity first, administration after. The night mode control of
// G3 lives here for now (it is the one setting the shell already honours).

const MODES: { valeur: ModeNuit; libelle: string }[] = [
  { valeur: 'automatique', libelle: t('moi.modeAutomatique') },
  { valeur: 'clair', libelle: t('moi.modeClair') },
  { valeur: 'sombre', libelle: t('moi.modeSombre') },
]

export default function Moi() {
  const { theme, mode, definirMode } = useContexteTheme()
  const drapeaux = useDrapeaux()
  const mouvementReduit = useReducedMotion()

  const lignes = [
    ...(drapeaux.data?.face_a_face === true ? [t('moi.faceAFace')] : []),
    t('moi.mesRecompenses'),
    t('moi.monAbonnement'),
    t('moi.reglages'),
  ]

  return (
    <ScrollView style={{ backgroundColor: theme.fond }} contentContainerStyle={styles.contenu}>
      <EnteteEcran titre={t('moi.titre')} />

      <View style={styles.sections}>
        <CartePlaceholder phrase={t('moi.placeholderProfil')} />

        <Carte style={styles.liste}>
          {lignes.map((libelle, index) => (
            <View
              key={libelle}
              style={[
                styles.ligne,
                index > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: theme.bordure,
                },
              ]}
            >
              <Text style={[typographie.corpsFort, { color: theme.texte, flex: 1 }]}>
                {libelle}
              </Text>
              <View style={[styles.puce, { backgroundColor: theme.carteDouce }]}>
                <Text style={[typographie.etiquette, { color: theme.texteSecondaire }]}>
                  {t('commun.bientot')}
                </Text>
              </View>
            </View>
          ))}
        </Carte>

        <Carte teinte="voix">
          <Text style={[typographie.corpsFort, { color: theme.texte }]}>{t('moi.ateliers')}</Text>
        </Carte>

        <View style={styles.section}>
          <Titre niveau="section">{t('moi.confort')}</Titre>
          <Carte style={styles.confort}>
            <Text style={[typographie.corpsFort, { color: theme.texte }]}>{t('moi.modeNuit')}</Text>
            <View style={[styles.segments, { backgroundColor: theme.carteDouce }]}>
              {MODES.map((option) => {
                const actif = option.valeur === mode
                return (
                  <Pressable
                    key={option.valeur}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: actif }}
                    onPress={() => definirMode(option.valeur)}
                    style={[styles.segment, actif && { backgroundColor: theme.carte }]}
                  >
                    <Text
                      style={[
                        typographie.petit,
                        { color: actif ? theme.texte : theme.texteSecondaire },
                      ]}
                    >
                      {option.libelle}
                    </Text>
                  </Pressable>
                )
              })}
            </View>

            <View style={[styles.ligne, styles.sansMarge]}>
              <View style={{ flex: 1 }}>
                <Text style={[typographie.corpsFort, { color: theme.texte }]}>
                  {t('moi.reduireAnimations')}
                </Text>
                <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>
                  {mouvementReduit
                    ? t('moi.reduireAnimationsDetail')
                    : t('moi.reduireAnimationsSysteme')}
                </Text>
              </View>
            </View>
          </Carte>
        </View>
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
