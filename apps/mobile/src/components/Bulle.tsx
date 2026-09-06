import { useEffect } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { t } from '@/i18n/fr'
import { couleurs } from '@/theme/tokens'

// Bulle, the mascot, as a placeholder: a soft circle in "or" that breathes slowly.
// The final character comes later; every screen already places it through this component.

export type TailleBulle = 'petite' | 'moyenne' | 'grande'

const DIAMETRES: Record<TailleBulle, number> = { petite: 40, moyenne: 96, grande: 160 }

type Props = {
  taille?: TailleBulle
  /** Bulle listens without moving (recording screens) or the person asked for calm. */
  calme?: boolean
  style?: StyleProp<ViewStyle>
}

export function Bulle({ taille = 'moyenne', calme = false, style }: Props) {
  const mouvementReduit = useReducedMotion()
  const immobile = calme || mouvementReduit
  const souffle = useSharedValue(0)

  useEffect(() => {
    if (immobile) {
      cancelAnimation(souffle)
      souffle.set(withTiming(0, { duration: 300 }))
      return
    }
    souffle.set(
      withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true),
    )
    return () => cancelAnimation(souffle)
  }, [immobile, souffle])

  const styleCorps = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + souffle.get() * 0.05 }],
  }))

  const styleHalo = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + souffle.get() * 0.12 }],
    opacity: 0.22 + souffle.get() * 0.1,
  }))

  const diametre = DIAMETRES[taille]
  const halo = diametre * 1.35
  const reflet = Math.max(4, diametre * 0.18)

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={t('commun.bulle')}
      style={[{ width: halo, height: halo }, styles.conteneur, style]}
    >
      <Animated.View
        style={[styles.halo, { width: halo, height: halo, borderRadius: halo / 2 }, styleHalo]}
      />
      <Animated.View
        style={[
          styles.corps,
          { width: diametre, height: diametre, borderRadius: diametre / 2 },
          styleCorps,
        ]}
      >
        <View
          style={[
            styles.reflet,
            {
              width: reflet,
              height: reflet,
              borderRadius: reflet / 2,
              top: diametre * 0.2,
              left: diametre * 0.24,
            },
          ]}
        />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  conteneur: { alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', backgroundColor: couleurs.or },
  corps: {
    backgroundColor: couleurs.or,
    shadowColor: couleurs.orange,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  reflet: { position: 'absolute', backgroundColor: 'rgba(255, 255, 255, 0.75)' },
})
