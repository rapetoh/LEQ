import { View } from 'react-native'
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg'

import { couleurs } from '@/theme/tokens'

// The crown of the week, drawn: a gold band, three points with their stones, and the light
// falling on the top edge. It marks the person who carried a week, on the podium and on the row
// that opens it; nothing else in the app wears one, so it means only that.

export function Couronne({ taille = 34 }: { taille?: number }) {
  const hauteur = Math.round(taille * 0.78)
  return (
    <View style={{ width: taille, height: hauteur }} accessible={false}>
      <Svg width={taille} height={hauteur} viewBox="0 0 40 31">
        <Defs>
          <LinearGradient id="couronneOr" x1="0.1" y1="0" x2="0.9" y2="1">
            <Stop offset="0" stopColor="#FFE6A8" />
            <Stop offset="0.45" stopColor={couleurs.or} />
            <Stop offset="1" stopColor="#D9891A" />
          </LinearGradient>
          <LinearGradient id="couronneReflet" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.5" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path d="M3 23 L6.5 6 L14 14.5 L20 3.5 L26 14.5 L33.5 6 L37 23 Z" fill="url(#couronneOr)" />
        <Path
          d="M3 23 L6.5 6 L14 14.5 L20 3.5 L26 14.5 L33.5 6 L37 23 Z"
          fill="url(#couronneReflet)"
        />
        <Rect x="3" y="22" width="34" height="6.5" rx="3" fill="url(#couronneOr)" />
        <Circle cx="20" cy="3.5" r="2.6" fill="#FFF3D0" />
        <Circle cx="6.5" cy="6" r="2.1" fill="#FFF3D0" />
        <Circle cx="33.5" cy="6" r="2.1" fill="#FFF3D0" />
        <Circle cx="20" cy="25.2" r="1.9" fill={couleurs.bleuNuit} opacity="0.35" />
      </Svg>
    </View>
  )
}
