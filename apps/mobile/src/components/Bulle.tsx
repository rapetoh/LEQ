import { useEffect } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { t } from '@/i18n/fr'
import { useContexteTheme } from '@/theme/ThemeProvider'
import { couleurs } from '@/theme/tokens'

// Bulle, the mascot, exactly as the validated mockup draws it: a speech bubble in "or" with a
// tail at the bottom left, two blinking eyes, and a mouth that speaks (bars), smiles, or waits
// (open). The geometry is the mockup's at 150 px wide, scaled for the three sizes it uses.

export type TailleBulle = 'petite' | 'moyenne' | 'grande'
export type VisageBulle = 'parle' | 'sourit' | 'attend'

/** Widths taken from the mockup: B5 (52), A2 (96), A1 (150). */
const LARGEURS: Record<TailleBulle, number> = { petite: 52, moyenne: 96, grande: 150 }
const BASE = 150

type Props = {
  taille?: TailleBulle
  /** Bulle listens without moving (recording screens) or the person asked for calm. */
  calme?: boolean
  /** The mouth: speaking bars by default, a smile when calm, an open mouth while waiting. */
  visage?: VisageBulle
  style?: StyleProp<ViewStyle>
}

export function Bulle({ taille = 'moyenne', calme = false, visage, style }: Props) {
  const mouvementReduit = useReducedMotion()
  const { animationsReduites } = useContexteTheme()
  const immobile = calme || mouvementReduit || animationsReduites
  const face: VisageBulle = visage ?? (calme ? 'sourit' : 'parle')
  const s = LARGEURS[taille] / BASE

  const flotte = useSharedValue(0)
  const cligne = useSharedValue(1)
  const parle1 = useSharedValue(0.45)
  const parle2 = useSharedValue(1)
  const parle3 = useSharedValue(0.7)

  // Two effects, not one. When they were together, changing the mouth restarted the float and
  // the blink as well: Bulle jumped every time a screen went from speaking to smiling.
  useEffect(() => {
    if (immobile) {
      cancelAnimation(flotte)
      cancelAnimation(cligne)
      flotte.set(withTiming(0, { duration: 300 }))
      cligne.set(1)
      return
    }
    flotte.set(
      withRepeat(withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.sin) }), -1, true),
    )
    cligne.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 3800 }),
          withTiming(0.08, { duration: 110 }),
          withTiming(1, { duration: 180 }),
        ),
        -1,
        false,
      ),
    )
    return () => {
      cancelAnimation(flotte)
      cancelAnimation(cligne)
    }
  }, [immobile, flotte, cligne])

  useEffect(() => {
    if (immobile || face !== 'parle') {
      cancelAnimation(parle1)
      cancelAnimation(parle2)
      cancelAnimation(parle3)
      return
    }
    parle1.set(
      withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.sin) }), -1, true),
    )
    parle2.set(
      withRepeat(withTiming(0.4, { duration: 850, easing: Easing.inOut(Easing.sin) }), -1, true),
    )
    parle3.set(
      withRepeat(withTiming(0.35, { duration: 750, easing: Easing.inOut(Easing.sin) }), -1, true),
    )
    return () => {
      cancelAnimation(parle1)
      cancelAnimation(parle2)
      cancelAnimation(parle3)
    }
  }, [immobile, face, parle1, parle2, parle3])

  const styleFlotte = useAnimatedStyle(() => ({
    transform: [{ translateY: -4 * s * flotte.get() }],
  }))
  const styleYeux = useAnimatedStyle(() => ({ transform: [{ scaleY: cligne.get() }] }))
  // The mouth scales, it does not resize. Animating `height` ran a layout pass on every frame for
  // four bars that are barely two points wide at the small size, and that is what flickered.
  const styleBarre1 = useAnimatedStyle(() => ({ transform: [{ scaleY: parle1.get() }] }))
  const styleBarre2 = useAnimatedStyle(() => ({ transform: [{ scaleY: parle2.get() }] }))
  const styleBarre3 = useAnimatedStyle(() => ({ transform: [{ scaleY: parle3.get() }] }))

  const oeil = {
    position: 'absolute' as const,
    top: 40 * s,
    width: 11 * s,
    height: 17 * s,
    borderRadius: 6 * s,
    backgroundColor: couleurs.bleuNuit,
  }
  const barre = {
    width: 4.5 * s,
    height: 17 * s,
    borderRadius: 2 * s,
    backgroundColor: couleurs.bleuNuit,
  }

  return (
    <Animated.View
      accessibilityRole="image"
      accessibilityLabel={t('commun.bulle')}
      style={[{ width: 150 * s, height: 134 * s }, styleFlotte, style]}
    >
      <View
        style={[
          styles.absolu,
          {
            top: 10 * s,
            left: 10 * s,
            width: 130 * s,
            height: 96 * s,
            borderRadius: 36 * s,
            backgroundColor: couleurs.or,
          },
        ]}
      />
      <View
        style={[
          styles.absolu,
          {
            top: 98 * s,
            left: 38 * s,
            width: 0,
            height: 0,
            borderLeftWidth: 6 * s,
            borderRightWidth: 20 * s,
            borderTopWidth: 26 * s,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderTopColor: couleurs.or,
          },
        ]}
      />
      <Animated.View style={[oeil, { left: 44 * s }, styleYeux]} />
      <Animated.View style={[oeil, { left: 90 * s }, styleYeux]} />
      {face === 'parle' ? (
        <View
          style={[
            styles.absolu,
            styles.bouche,
            { top: 70 * s, left: 56 * s, height: 17 * s, gap: 3 * s },
          ]}
        >
          <Animated.View style={[barre, styleBarre1]} />
          <Animated.View style={[barre, styleBarre2]} />
          <Animated.View style={[barre, styleBarre3]} />
          <Animated.View style={[barre, styleBarre1]} />
        </View>
      ) : face === 'sourit' ? (
        <View
          style={[
            styles.absolu,
            {
              top: 69 * s,
              left: 59 * s,
              width: 19 * s,
              height: 9 * s,
              borderBottomLeftRadius: 11 * s,
              borderBottomRightRadius: 11 * s,
              borderBottomWidth: 4 * s,
              borderLeftWidth: 4 * s,
              borderRightWidth: 4 * s,
              borderBottomColor: couleurs.bleuNuit,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
            },
          ]}
        />
      ) : (
        <View
          style={[
            styles.absolu,
            {
              top: 72 * s,
              left: 55 * s,
              width: 31 * s,
              height: 14 * s,
              borderBottomLeftRadius: 17 * s,
              borderBottomRightRadius: 17 * s,
              backgroundColor: couleurs.bleuNuit,
            },
          ]}
        />
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  absolu: { position: 'absolute' },
  bouche: { flexDirection: 'row', alignItems: 'center' },
})
