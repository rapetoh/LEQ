import { View } from 'react-native'
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg'

import { couleurs } from '@/theme/tokens'

// Rétor's own mark. Bulle is LEQ speaking to the person, with eyes and a mouth; Rétor is the
// voice on the other side of the table, so his mark is the same speech bubble turned round, its
// tail on the right, drawn in gold on bleu nuit and with no face at all. He is not a mascot: he
// contradicts, and the thing a person needs to recognise is that this is the other voice.

export function MarqueRetor({ taille = 44 }: { taille?: number }) {
  return (
    <View style={{ width: taille, height: taille }} accessible={false}>
      <Svg width={taille} height={taille} viewBox="0 0 44 44">
        <Defs>
          <LinearGradient id="retorFond" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#0D2A4E" />
            <Stop offset="1" stopColor={couleurs.bleuNuit} />
          </LinearGradient>
        </Defs>
        <Rect x="0.75" y="0.75" width="42.5" height="42.5" rx="13" fill="url(#retorFond)" />
        <Rect
          x="0.75"
          y="0.75"
          width="42.5"
          height="42.5"
          rx="13"
          fill="none"
          stroke={couleurs.or}
          strokeWidth="1.5"
          strokeOpacity="0.75"
        />
        {/* The bubble, mirrored: rounded body, tail at the bottom right. */}
        <Path
          d="M11 14.5 A3.5 3.5 0 0 1 14.5 11 h15 A3.5 3.5 0 0 1 33 14.5 v9 A3.5 3.5 0 0 1 29.5 27 h-3.5 l5 6 l-9.5 -6 h-7 A3.5 3.5 0 0 1 11 23.5 Z"
          fill="none"
          stroke={couleurs.or}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* Two bars where a face would be: he argues, he does not smile. */}
        <Path
          d="M16 17.5 h12 M16 21.5 h7"
          stroke={couleurs.or}
          strokeWidth="2"
          strokeLinecap="round"
          strokeOpacity="0.85"
        />
      </Svg>
    </View>
  )
}
