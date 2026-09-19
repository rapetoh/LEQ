import { StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg'

import { couleurs, polices } from '@/theme/tokens'

// The three places of a podium, drawn rather than picked from an icon set: a disc with its own
// gradient, a rim, a highlight across the top and the number in the metal's own ink. Gold,
// silver and bronze are the only three it draws, and it never invents a fourth.

export type Place = 1 | 2 | 3

export const METAUX: Record<Place, { clair: string; fonce: string; encre: string; rim: string }> = {
  1: { clair: '#FFD98A', fonce: '#E0951B', encre: couleurs.bleuNuit, rim: '#FFE9B8' },
  2: { clair: '#E7EDF5', fonce: '#9AA8BC', encre: couleurs.bleuNuit, rim: '#F4F7FB' },
  3: { clair: '#EBB088', fonce: '#B0713F', encre: couleurs.blanc, rim: '#F0C9A3' },
}

export function Medaille({ place, taille = 40 }: { place: Place; taille?: number }) {
  const metal = METAUX[place]
  return (
    <View style={{ width: taille, height: taille }} accessible={false}>
      <Svg width={taille} height={taille} viewBox="0 0 40 40">
        <Defs>
          <LinearGradient id={`medaille${place}`} x1="0.15" y1="0" x2="0.85" y2="1">
            <Stop offset="0" stopColor={metal.clair} />
            <Stop offset="1" stopColor={metal.fonce} />
          </LinearGradient>
          <LinearGradient id={`reflet${place}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Circle cx="20" cy="20" r="19" fill={`url(#medaille${place})`} />
        <Circle cx="20" cy="20" r="19" fill="none" stroke={metal.rim} strokeWidth="1.4" />
        {/* The light falls on the top of the disc, which is what makes a flat circle read round. */}
        <Path d="M4 17 A16 16 0 0 1 36 17 A16 22 0 0 0 4 17 Z" fill={`url(#reflet${place})`} />
      </Svg>
      <View style={styles.centre}>
        <Text
          style={[
            styles.chiffre,
            {
              color: metal.encre,
              fontSize: Math.round(taille * 0.44),
              lineHeight: Math.round(taille * 0.52),
            },
          ]}
        >
          {place}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  centre: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chiffre: { fontFamily: polices.extraBold },
})
