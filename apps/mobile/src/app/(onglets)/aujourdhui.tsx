import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { CartePlaceholder } from '@/components/CartePlaceholder'
import { EnteteEcran } from '@/components/EnteteEcran'
import { Carte } from '@/components/ui/Carte'
import { Titre } from '@/components/ui/Titre'
import { t } from '@/i18n/fr'
import { useConfiguration, useDrapeaux } from '@/services/configuration'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, rayons, typographie } from '@/theme/tokens'

// B1 · Aujourd'hui (C0 variant while the Arena is off). The daily challenge, the tip, the
// points, the week's subject, and what Rebecca offers. Content arrives with Phases 1 to 6.

function dateDuJour(): string {
  const brut = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return brut.charAt(0).toUpperCase() + brut.slice(1)
}

export default function Aujourdhui() {
  const theme = useTheme()
  const configuration = useConfiguration()
  const drapeaux = useDrapeaux()
  const areneActive = drapeaux.data?.arene === true
  const points = configuration.data?.points_par_defi ?? 25

  return (
    <ScrollView style={{ backgroundColor: theme.fond }} contentContainerStyle={styles.contenu}>
      <EnteteEcran surtitre={dateDuJour()} titre={t('aujourdhui.salutationSansPrenom')} />

      <View style={styles.sections}>
        <Carte teinte="orange" style={styles.defi}>
          <View style={styles.ligne}>
            <Text style={[typographie.etiquette, { color: theme.texteSecondaire, flex: 1 }]}>
              {t('aujourdhui.defiDuJour', { minutes: 2 })}
            </Text>
            <View style={[styles.pilule, { backgroundColor: theme.accent }]}>
              <Text style={[typographie.etiquette, { color: theme.accentTexte }]}>
                {t('aujourdhui.points', { points })}
              </Text>
            </View>
          </View>
          <CartePlaceholder phrase={t('aujourdhui.placeholderDefi')} />
        </Carte>

        <View style={styles.section}>
          <Titre niveau="section">{t('aujourdhui.conseilDuJour')}</Titre>
          <CartePlaceholder phrase={t('aujourdhui.placeholderConseil')} />
        </View>

        <CartePlaceholder
          titre={t('aujourdhui.pointsLibelle')}
          phrase={t('aujourdhui.placeholderPoints')}
        />

        {areneActive ? (
          <CartePlaceholder
            titre={t('aujourdhui.sujetSemaine')}
            phrase={t('aujourdhui.placeholderSujet')}
          />
        ) : (
          <Carte teinte="douce">
            <Text style={[typographie.titreCarte, { color: theme.texte }]}>
              {t('aujourdhui.areneBientotTitre')}
            </Text>
            <Text style={[typographie.corps, styles.espaceHaut, { color: theme.texteSecondaire }]}>
              {t('aujourdhui.areneBientot')}
            </Text>
          </Carte>
        )}

        <View style={styles.section}>
          <Titre niveau="section">{t('aujourdhui.avecRebecca')}</Titre>
          <CartePlaceholder phrase={t('aujourdhui.placeholderRebecca')} />
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  contenu: { paddingBottom: espaces.xxl },
  sections: { paddingHorizontal: espaces.xl, gap: espaces.l },
  section: { gap: espaces.s },
  defi: { gap: espaces.m },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espaces.s },
  pilule: {
    paddingHorizontal: espaces.s,
    paddingVertical: espaces.xxs,
    borderRadius: rayons.pilule,
  },
  espaceHaut: { marginTop: espaces.xs },
})
