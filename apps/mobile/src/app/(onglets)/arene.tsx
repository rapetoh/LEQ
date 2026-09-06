import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { CartePlaceholder } from '@/components/CartePlaceholder'
import { EnteteEcran } from '@/components/EnteteEcran'
import { t } from '@/i18n/fr'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, rayons, typographie } from '@/theme/tokens'

// C1 to C4 · L'Arène. Reachable only when drapeaux.arene is on (Phase 7).

type Volet = 'sujet' | 'duels'

export default function Arene() {
  const theme = useTheme()
  const [volet, setVolet] = useState<Volet>('sujet')

  const volets: { valeur: Volet; libelle: string }[] = [
    { valeur: 'sujet', libelle: t('arene.sujetDuMoment') },
    { valeur: 'duels', libelle: t('arene.mesDuels') },
  ]

  return (
    <ScrollView style={{ backgroundColor: theme.fond }} contentContainerStyle={styles.contenu}>
      <EnteteEcran titre={t('arene.titre')} />
      <View style={styles.sections}>
        <View style={[styles.segments, { backgroundColor: theme.carteDouce }]}>
          {volets.map((option) => {
            const actif = option.valeur === volet
            return (
              <Pressable
                key={option.valeur}
                accessibilityRole="tab"
                accessibilityState={{ selected: actif }}
                onPress={() => setVolet(option.valeur)}
                style={[styles.segment, actif && { backgroundColor: theme.carte }]}
              >
                <Text
                  style={[
                    typographie.corpsFort,
                    { color: actif ? theme.texte : theme.texteSecondaire },
                  ]}
                >
                  {option.libelle}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {volet === 'sujet' ? (
          <CartePlaceholder
            titre={t('aujourdhui.sujetSemaine')}
            phrase={t('arene.placeholderSujet')}
          />
        ) : (
          <CartePlaceholder titre={t('arene.mesDuels')} phrase={t('arene.placeholderDuels')} />
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  contenu: { paddingBottom: espaces.xxl },
  sections: { paddingHorizontal: espaces.xl, gap: espaces.l },
  segments: { flexDirection: 'row', padding: 3, borderRadius: rayons.pilule },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: espaces.s,
    borderRadius: rayons.pilule,
  },
})
