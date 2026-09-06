import type { Atelier } from '@leq/domaine'
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'

import { Bouton } from '@/components/ui/Bouton'
import { Carte } from '@/components/ui/Carte'
import { t } from '@/i18n/fr'
import { lieuEtDate } from '@/services/rebecca'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, rayons, typographie } from '@/theme/tokens'

// One of Rebecca's workshops, as B1, B1b and F1 show it: where and when, the places, what it
// is, and the door to book it (outside the app). The points line appears when a reward of
// the shop gives a place.

type Props = {
  atelier: Atelier
  coutPlace?: number | null
  compact?: boolean
  onOuvrir?: () => void
}

export function CarteAtelier({ atelier, coutPlace = null, compact = false, onOuvrir }: Props) {
  const theme = useTheme()
  const contenu = (
    <Carte teinte="voix" style={styles.carte}>
      <View style={styles.ligne}>
        <Text style={[typographie.etiquette, { color: theme.texteSecondaire, flex: 1 }]}>
          {atelier.en_ligne
            ? t('aujourdhui.atelierEnDirect')
            : t('aujourdhui.atelierEnSalle', { lieu: atelier.lieu })}
        </Text>
        {atelier.places !== null ? (
          <View style={[styles.pilule, { backgroundColor: theme.carte }]}>
            <Text style={[typographie.etiquette, { color: theme.texte }]}>
              {atelier.places === 1
                ? t('rebecca.place')
                : t('rebecca.places', { places: atelier.places })}
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={[typographie.titreCarte, { color: theme.texte }]}>{atelier.titre}</Text>
      <Text style={[typographie.petit, { color: theme.texteSecondaire }]}>
        {lieuEtDate(atelier)}
      </Text>
      {!compact && atelier.description ? (
        <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
          {atelier.description}
        </Text>
      ) : null}
      {!compact && coutPlace !== null ? (
        <Text style={[typographie.petit, { color: theme.texteSecondaire }]}>
          {t('rebecca.pointsPlace', { cout: coutPlace })}
        </Text>
      ) : null}
      {!compact && atelier.lien ? (
        <Bouton
          libelle={t('rebecca.reserver')}
          variante="secondaire"
          onPress={() => void Linking.openURL(atelier.lien ?? '')}
        />
      ) : null}
    </Carte>
  )
  if (!onOuvrir) return contenu
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={atelier.titre} onPress={onOuvrir}>
      {contenu}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  carte: { gap: espaces.xs },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espaces.s },
  pilule: {
    paddingHorizontal: espaces.s,
    paddingVertical: espaces.xxs,
    borderRadius: rayons.pilule,
  },
})
