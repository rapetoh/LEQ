import { StyleSheet, Text, View } from 'react-native'

import { Titre } from '@/components/ui/Titre'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, rayons, typographie } from '@/theme/tokens'

// The head of a défi as the mockup draws it on B1 and B3: the small line with the format
// and the minutes, the points pill, the title, then where the défi sits in the act.

type Props = {
  surtitre: string
  points: string
  titre: string
  position: string
  niveau?: 'ecran' | 'section'
}

export function EnteteDefi({ surtitre, points, titre, position, niveau = 'section' }: Props) {
  const theme = useTheme()
  return (
    <View style={styles.bloc}>
      <View style={styles.ligne}>
        <Text style={[typographie.etiquette, { color: theme.texteSecondaire, flex: 1 }]}>
          {surtitre}
        </Text>
        <View style={[styles.pilule, { backgroundColor: theme.accent }]}>
          <Text style={[typographie.etiquette, { color: theme.accentTexte }]}>{points}</Text>
        </View>
      </View>
      <Titre niveau={niveau}>{titre}</Titre>
      <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>{position}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  bloc: { gap: espaces.xs },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espaces.s },
  pilule: {
    paddingHorizontal: espaces.s,
    paddingVertical: espaces.xxs,
    borderRadius: rayons.pilule,
  },
})
