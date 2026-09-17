import { useEffect, useState } from 'react'
import { Image, StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import { couleurs } from '@/theme/tokens'

// The launch, drawn over the app while it loads: the mark writes itself. L, E and Q rise into
// place one after the other, then the period arrives from above as a dot and strikes the end of
// the word; the letters take the hit and settle. Then the app underneath is ready and the
// whole thing fades. It never takes longer than the loading it covers, plus the second the
// gesture needs, and it plays once per cold start. With Reduce Motion on, the mark is simply
// there and fades out.
//
// The letters are the brand's own glyphs, windows cut out of the white mark image (measured
// once in image pixels: L 373..623, E 648..911, Q 917..1308, the dot centred at 1407, 551 with
// a radius of 62, the mark spanning 373..1469 by 202..622). The dot is drawn, not cut out, so
// it can fall.

const IMAGE = { largeur: 1800, hauteur: 800 }
const MARQUE = { x: 373, y: 202, largeur: 1096, hauteur: 420 }
const LETTRES = [
  { x0: 373, x1: 623 },
  { x0: 648, x1: 911 },
  { x0: 917, x1: 1308 },
] as const
const POINT = { cx: 1407.5, cy: 551.5, r: 62 }
const MARGE = 5

/** Display width of the mark, dot included: a little under half the screen. */
const LARGEUR = 190
const ECHELLE = LARGEUR / MARQUE.largeur

const DUREE_FONDU = 260
/** When the gesture is over and the app may take the screen. */
const FIN_DU_GESTE = 1150

type Props = {
  /** Fonts and session are loaded: the app underneath can be shown. */
  pret: boolean
  /** The overlay has been laid out: the native launch screen may go. */
  onPremierRendu: () => void
  /** The fade is over: unmount. */
  onFin: () => void
}

export function Lancement({ pret, onPremierRendu, onFin }: Props) {
  const mouvementReduit = useReducedMotion()
  const [gesteFini, setGesteFini] = useState(mouvementReduit)
  const [premierRendu, setPremierRendu] = useState(false)

  const lettres = [useSharedValue(0), useSharedValue(0), useSharedValue(0)]
  const secousse = useSharedValue(0)
  const chute = useSharedValue(0)
  const tailleDuPoint = useSharedValue(1)
  const visibilitePoint = useSharedValue(0)
  const fondu = useSharedValue(1)

  const surLayout = (_e: LayoutChangeEvent) => {
    if (premierRendu) return
    setPremierRendu(true)
    onPremierRendu()
  }

  // The gesture, once.
  useEffect(() => {
    if (mouvementReduit) {
      lettres.forEach((l) => l.set(1))
      visibilitePoint.set(1)
      return
    }
    lettres.forEach((lettre, index) => {
      lettre.set(
        withDelay(
          160 + index * 90,
          withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }),
        ),
      )
    })
    // The dot: appears high and large, falls faster and faster, lands with a small overshoot.
    visibilitePoint.set(withDelay(560, withTiming(1, { duration: 70 })))
    chute.set(withDelay(560, withTiming(1, { duration: 230, easing: Easing.in(Easing.quad) })))
    tailleDuPoint.set(
      withSequence(
        withTiming(1.35, { duration: 560 }),
        withTiming(1.35, { duration: 230 }),
        withSpring(1, { damping: 9, stiffness: 520, mass: 0.6 }),
      ),
    )
    // The letters take the hit: a short dip, then they settle.
    secousse.set(
      withDelay(
        790,
        withSequence(
          withTiming(1, { duration: 70, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 300, easing: Easing.out(Easing.back(2)) }),
        ),
      ),
    )
    const minuteur = setTimeout(() => setGesteFini(true), FIN_DU_GESTE)
    return () => clearTimeout(minuteur)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mouvementReduit])

  // The app is ready and the gesture is over: fade, then leave.
  useEffect(() => {
    if (!pret || !gesteFini) return
    fondu.set(
      withTiming(0, { duration: DUREE_FONDU, easing: Easing.out(Easing.quad) }, (fini) => {
        if (fini) runOnJS(onFin)()
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pret, gesteFini])

  const styleFondu = useAnimatedStyle(() => ({ opacity: fondu.get() }))
  const styleLettre0 = useAnimatedStyle(() => styleDeLettre(lettres[0]!.get(), secousse.get()))
  const styleLettre1 = useAnimatedStyle(() => styleDeLettre(lettres[1]!.get(), secousse.get()))
  const styleLettre2 = useAnimatedStyle(() => styleDeLettre(lettres[2]!.get(), secousse.get()))
  const stylesLettres = [styleLettre0, styleLettre1, styleLettre2]
  const stylePoint = useAnimatedStyle(() => ({
    opacity: visibilitePoint.get(),
    transform: [{ translateY: (1 - chute.get()) * -150 }, { scale: tailleDuPoint.get() }],
  }))

  const diametre = POINT.r * 2 * ECHELLE
  return (
    <Animated.View
      style={[styles.ecran, styleFondu]}
      onLayout={surLayout}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={{ width: LARGEUR, height: MARQUE.hauteur * ECHELLE }}>
        {LETTRES.map((lettre, index) => {
          const gauche = (lettre.x0 - MARGE - MARQUE.x) * ECHELLE
          const largeur = (lettre.x1 - lettre.x0 + 2 * MARGE) * ECHELLE
          return (
            <Animated.View
              key={lettre.x0}
              style={[
                styles.fenetre,
                { left: gauche, width: largeur, height: MARQUE.hauteur * ECHELLE },
                stylesLettres[index],
              ]}
            >
              <Image
                source={require('../../assets/marque/sigle-blanc.png')}
                style={{
                  position: 'absolute',
                  width: IMAGE.largeur * ECHELLE,
                  height: IMAGE.hauteur * ECHELLE,
                  left: -(lettre.x0 - MARGE) * ECHELLE,
                  top: -MARQUE.y * ECHELLE,
                }}
                accessible={false}
              />
            </Animated.View>
          )
        })}
        <Animated.View
          style={[
            styles.point,
            {
              width: diametre,
              height: diametre,
              borderRadius: diametre / 2,
              left: (POINT.cx - POINT.r - MARQUE.x) * ECHELLE,
              top: (POINT.cy - POINT.r - MARQUE.y) * ECHELLE,
            },
            stylePoint,
          ]}
        />
      </View>
    </Animated.View>
  )
}

function styleDeLettre(entree: number, secousse: number) {
  'worklet'
  return {
    opacity: entree,
    transform: [{ translateY: (1 - entree) * 22 + secousse * 5 }],
  }
}

const styles = StyleSheet.create({
  ecran: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: couleurs.bleuNuit,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    elevation: 10,
  },
  fenetre: { position: 'absolute', top: 0, overflow: 'hidden' },
  point: { position: 'absolute', backgroundColor: couleurs.orange },
})
