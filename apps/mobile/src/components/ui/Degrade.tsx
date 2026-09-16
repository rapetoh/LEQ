import { useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

// A gradient behind a card, the way the mockup paints its hero cards. It measures the card it
// sits in and draws to that size: a percentage width on the SVG root is not reliable before
// layout, and the first frame then showed a card painted three quarters of the way.

type Props = {
  de: string
  a: string
  rayon: number
  /** Identifier of the gradient, unique per screen. */
  id: string
}

export function Degrade({ de, a, rayon, id }: Props) {
  const [taille, setTaille] = useState<{ largeur: number; hauteur: number } | null>(null)
  const surLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    if (!taille || taille.largeur !== width || taille.hauteur !== height) {
      setTaille({ largeur: width, hauteur: height })
    }
  }
  return (
    <View style={StyleSheet.absoluteFill} onLayout={surLayout} pointerEvents="none">
      {taille ? (
        <Svg width={taille.largeur} height={taille.hauteur}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={de} />
              <Stop offset="1" stopColor={a} />
            </LinearGradient>
          </Defs>
          <Rect width={taille.largeur} height={taille.hauteur} rx={rayon} fill={`url(#${id})`} />
        </Svg>
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: de, borderRadius: rayon }]} />
      )}
    </View>
  )
}
