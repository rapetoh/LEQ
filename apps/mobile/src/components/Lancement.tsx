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

// The launch, drawn over the app while it loads: the mark writes itself. The screen holds plain
// bleu nuit for a beat, L, E and Q rise into place one after the other, then the period arrives
// from above as a dot and strikes the end of the word; the letters take the hit and settle; the
// finished mark rests, still, for half a second; then it fades and the app is underneath.
//
// Two rules, both learned the hard way on build 21, which Roch found precipitated:
//
//  1. The gesture starts on the first frame the overlay is actually on screen (`onLayout`), never
//     on mount. Started on mount, its clock runs behind the native launch screen and the person
//     meets the animation already half over.
//  2. The gesture owns its own clock. Being ready to show the app does not cut it short: the mark
//     lands, settles and rests whatever the loading did. If loading is slower than the gesture,
//     the finished mark simply stays until the app is ready, which is a better waiting state than
//     anything else we could draw.
//
// With Reduce Motion on, the mark is there at once, rests, and fades.
//
// The letters are the brand's own glyphs, windows cut out of the white mark image (measured once
// in image pixels: L 373..623, E 648..911, Q 917..1308, the dot centred at 1407, 551 with a
// radius of 62, the mark spanning 373..1469 by 202..622). The dot is drawn, not cut out, so it
// can fall.

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

/**
 * The gesture, in milliseconds from the first visible frame. The empty beat at the start and the
 * rest at the end are the two halves a launch needs to read as deliberate rather than rushed.
 */
const TEMPS = {
  /** Plain bleu nuit, nothing yet. */
  attaque: 260,
  /** Each letter's rise, and the gap between two letters. */
  lettre: 320,
  ecart: 120,
  /** The dot leaves the top just as the last letter arrives. */
  departDuPoint: 780,
  chute: 300,
  /** The dot lands: `departDuPoint + chute`. */
  impact: 1080,
  /** The mark is formed and still from here, and rests until `sortie`. */
  repos: 1500,
  /** The gesture is over; the screen may leave once the app is ready. */
  sortie: 2020,
  fondu: 340,
  /** Reduce Motion: the mark is there at once and still rests, so it cannot flash past. */
  reposImmobile: 700,
} as const

/** How far above its place the dot starts, in points. */
const HAUTEUR_DE_CHUTE = 160

type Props = {
  /** Fonts and session are loaded: the app underneath can be shown. */
  pret: boolean
  /** The overlay has drawn its first frame: the native launch screen may go. */
  onPremierRendu: () => void
  /** The fade is over: unmount. */
  onFin: () => void
}

export function Lancement({ pret, onPremierRendu, onFin }: Props) {
  const mouvementReduit = useReducedMotion()
  const [demarre, setDemarre] = useState(false)
  const [gesteFini, setGesteFini] = useState(false)

  const lettre0 = useSharedValue(0)
  const lettre1 = useSharedValue(0)
  const lettre2 = useSharedValue(0)
  const secousse = useSharedValue(0)
  const chute = useSharedValue(0)
  const tailleDuPoint = useSharedValue(1)
  const visibilitePoint = useSharedValue(0)
  const fondu = useSharedValue(1)

  // The first frame on screen, and not before: see rule 1 above.
  const surLayout = (_e: LayoutChangeEvent) => {
    if (demarre) return
    setDemarre(true)
    onPremierRendu()
  }

  useEffect(() => {
    if (!demarre) return

    if (mouvementReduit) {
      lettre0.set(1)
      lettre1.set(1)
      lettre2.set(1)
      // The dot sits at its place, not above it: `chute` is what brings it down, and with
      // Reduce Motion on nothing will ever animate it there.
      chute.set(1)
      visibilitePoint.set(1)
      const immobile = setTimeout(() => setGesteFini(true), TEMPS.reposImmobile)
      return () => clearTimeout(immobile)
    }

    const lettres = [lettre0, lettre1, lettre2]
    lettres.forEach((lettre, index) => {
      lettre.set(
        withDelay(
          TEMPS.attaque + index * TEMPS.ecart,
          withTiming(1, { duration: TEMPS.lettre, easing: Easing.out(Easing.cubic) }),
        ),
      )
    })

    // The dot falls as a dot: it appears above the word and comes down faster and faster.
    visibilitePoint.set(withDelay(TEMPS.departDuPoint, withTiming(1, { duration: 60 })))
    chute.set(
      withDelay(
        TEMPS.departDuPoint,
        withTiming(1, { duration: TEMPS.chute, easing: Easing.in(Easing.quad) }),
      ),
    )
    // It hits, pops once, and settles at its size.
    tailleDuPoint.set(
      withDelay(
        TEMPS.impact,
        withSequence(
          withTiming(1.18, { duration: 70, easing: Easing.out(Easing.quad) }),
          withSpring(1, { damping: 9, stiffness: 520, mass: 0.6 }),
        ),
      ),
    )
    // The letters take the hit: a short dip, then they settle.
    secousse.set(
      withDelay(
        TEMPS.impact,
        withSequence(
          withTiming(1, { duration: 70, easing: Easing.out(Easing.quad) }),
          withTiming(0, {
            duration: TEMPS.repos - TEMPS.impact - 70,
            easing: Easing.out(Easing.back(2)),
          }),
        ),
      ),
    )

    const minuteur = setTimeout(() => setGesteFini(true), TEMPS.sortie)
    return () => clearTimeout(minuteur)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demarre, mouvementReduit])

  // The gesture is over and the app is ready: fade, then leave. Neither one alone.
  useEffect(() => {
    if (!pret || !gesteFini) return
    fondu.set(
      withTiming(0, { duration: TEMPS.fondu, easing: Easing.out(Easing.quad) }, (fini) => {
        if (fini) runOnJS(onFin)()
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pret, gesteFini])

  const styleFondu = useAnimatedStyle(() => ({ opacity: fondu.get() }))
  const styleLettre0 = useAnimatedStyle(() => styleDeLettre(lettre0.get(), secousse.get()))
  const styleLettre1 = useAnimatedStyle(() => styleDeLettre(lettre1.get(), secousse.get()))
  const styleLettre2 = useAnimatedStyle(() => styleDeLettre(lettre2.get(), secousse.get()))
  const stylesLettres = [styleLettre0, styleLettre1, styleLettre2]
  const stylePoint = useAnimatedStyle(() => ({
    opacity: visibilitePoint.get(),
    transform: [
      { translateY: (1 - chute.get()) * -HAUTEUR_DE_CHUTE },
      { scale: tailleDuPoint.get() },
    ],
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
    transform: [{ translateY: (1 - entree) * 20 + secousse * 4 }],
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
