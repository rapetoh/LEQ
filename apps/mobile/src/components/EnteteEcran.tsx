import { StyleSheet, Text, View } from 'react-native'
import type { ReactNode } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Titre } from '@/components/ui/Titre'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, typographie } from '@/theme/tokens'

// Header of a content screen: an optional small line above, the title, an optional right slot.

type Props = {
  titre: string
  surtitre?: string
  droite?: ReactNode
}

export function EnteteEcran({ titre, surtitre, droite }: Props) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.entete, { paddingTop: insets.top + espaces.m }]}>
      <View style={styles.textes}>
        {surtitre ? (
          <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>{surtitre}</Text>
        ) : null}
        <Titre niveau="ecran">{titre}</Titre>
      </View>
      {droite}
    </View>
  )
}

const styles = StyleSheet.create({
  entete: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: espaces.xl,
    paddingBottom: espaces.m,
    gap: espaces.m,
  },
  textes: { flex: 1, gap: espaces.xxs },
})
