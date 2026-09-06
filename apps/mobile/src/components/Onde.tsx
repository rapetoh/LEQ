import { StyleSheet, View } from 'react-native'

import { useTheme } from '@/theme/ThemeProvider'

// The live waveform of the mockup (A4, B4): a row of bars fed by the level meter.
// Values are dBFS in [-100, 0]; silence stays a thin line, speech rises.

type Props = {
  niveaux: readonly number[]
  hauteur?: number
}

function proportion(dbfs: number): number {
  const borne = Math.min(0, Math.max(-60, dbfs))
  return (borne + 60) / 60
}

export function Onde({ niveaux, hauteur = 64 }: Props) {
  const theme = useTheme()
  return (
    <View style={[styles.ligne, { height: hauteur }]} accessible={false}>
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
  )
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  barre: { width: 4, borderRadius: 2 },
})
