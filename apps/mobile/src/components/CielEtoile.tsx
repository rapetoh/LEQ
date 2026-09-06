import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { couleurs } from '@/theme/tokens'

// Twinkling dots behind the bleu nuit hero screens (A1). Positions are deterministic so the
// sky looks the same at every launch. Static when the person prefers reduced motion.

type Etoile = { x: number; y: number; taille: number; delai: number; duree: number; teinte: string }

function generer(nombre: number): Etoile[] {
  let graine = 20260905
  const suivant = () => {
    graine = (graine * 1103515245 + 12345) % 2147483648
    return graine / 2147483648
  }
  const etoiles: Etoile[] = []
  for (let i = 0; i < nombre; i += 1) {
    etoiles.push({
      x: suivant() * 100,
      y: suivant() * 100,
      taille: 2 + Math.round(suivant() * 2),
      delai: Math.round(suivant() * 2500),
      duree: 1600 + Math.round(suivant() * 2200),
      teinte: suivant() < 0.2 ? couleurs.or : couleurs.blanc,
    })
  }
  return etoiles
}

const ETOILES = generer(32)

function Point({ etoile }: { etoile: Etoile }) {
  const mouvementReduit = useReducedMotion()
  const lueur = useSharedValue(0.35)

  useEffect(() => {
    if (mouvementReduit) {
      lueur.set(0.55)
      return
    }
    lueur.set(
      withDelay(
        etoile.delai,
        withRepeat(
          withTiming(1, { duration: etoile.duree, easing: Easing.inOut(Easing.quad) }),
          -1,
          true,
        ),
      ),
    )
    return () => cancelAnimation(lueur)
  }, [mouvementReduit, etoile.delai, etoile.duree, lueur])

  const style = useAnimatedStyle(() => ({ opacity: lueur.get() }))

  return (
    <Animated.View
      style={[
        styles.point,
        {
          left: `${etoile.x}%`,
          top: `${etoile.y}%`,
          width: etoile.taille,
          height: etoile.taille,
          borderRadius: etoile.taille / 2,
          backgroundColor: etoile.teinte,
        },
        style,
      ]}
    />
  )
}

export function CielEtoile() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden>
      {ETOILES.map((etoile, index) => (
        <Point key={index} etoile={etoile} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  point: { position: 'absolute' },
})
