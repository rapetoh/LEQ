import { StyleSheet, View } from 'react-native'

import { useTheme } from '@/theme/ThemeProvider'

// The live waveform of the mockup (A4, B4): a row of gold bars fed by the level meter, each
// bar sharing the width of the row. Values are dBFS in [-100, 0]; silence stays a thin line,
// speech rises. B4 draws a faint gold baseline under the bars; A4 does not.

type Props = {
  niveaux: readonly number[]
  hauteur?: number
  ligneDeBase?: boolean
}

function proportion(dbfs: number): number {
  const borne = Math.min(0, Math.max(-60, dbfs))
  return (borne + 60) / 60
}

export function Onde({ niveaux, hauteur = 64, ligneDeBase = false }: Props) {
  const theme = useTheme()
  return (
    <View style={styles.bloc} accessible={false}>
      <View style={[styles.ligne, { height: hauteur }]}>
        {niveaux.map((niveau, index) => (
          <View
            key={index}
            style={[
              styles.barre,
              { height: Math.max(4, proportion(niveau) * hauteur), backgroundColor: theme.voix },
            ]}
          />
        ))}
      </View>
      {ligneDeBase ? <View style={styles.base} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  bloc: { alignSelf: 'stretch', gap: 10 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  barre: { flex: 1, borderRadius: 2 },
  base: { height: 1, backgroundColor: 'rgba(255, 189, 89, 0.35)' },
})
