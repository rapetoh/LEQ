import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'

import { Carte } from '@/components/ui/Carte'
import { t } from '@/i18n/fr'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, rayons, typographie } from '@/theme/tokens'

// A card whose content depends on a later phase. It says so plainly, in French,
// with a small "En construction" chip, so nobody mistakes it for a finished feature.

type Props = {
  titre?: string
  phrase: string
  style?: StyleProp<ViewStyle>
}

export function CartePlaceholder({ titre, phrase, style }: Props) {
  const theme = useTheme()
  return (
    <Carte style={[styles.carte, { borderColor: theme.bordure }, style]} teinte="transparente">
      <View style={styles.entete}>
        {titre ? (
          <Text style={[typographie.titreCarte, { color: theme.texte, flex: 1 }]}>{titre}</Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <View style={[styles.puce, { backgroundColor: theme.carteDouce }]}>
          <Text style={[typographie.etiquette, { color: theme.texteSecondaire }]}>
            {t('commun.enConstruction')}
          </Text>
        </View>
      </View>
      <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>{phrase}</Text>
    </Carte>
  )
}

const styles = StyleSheet.create({
  carte: { borderWidth: 1.5, borderStyle: 'dashed', gap: espaces.xs },
  entete: { flexDirection: 'row', alignItems: 'center', gap: espaces.s },
  puce: {
    paddingHorizontal: espaces.xs,
    paddingVertical: espaces.xxs,
    borderRadius: rayons.pilule,
  },
})
