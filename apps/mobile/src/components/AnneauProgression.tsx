import { StyleSheet, View, type ViewStyle } from 'react-native'

import { couleurs } from '@/theme/tokens'

// The progress ring of the recording screens (A4, B4): a track and an arc in "or" that fills
// clockwise from the top as the take goes from zero to its maximum. Plain views, no library:
// two half-circles, each clipping a rotated circle whose top and right borders make a 180° arc.

/** Rotation of the arc so that its visible part covers [0, a] degrees in one half. */
export function rotationsPour(progression: number): { droite: number; gauche: number | null } {
  const a = Math.max(0, Math.min(1, progression)) * 360
  if (a <= 180) return { droite: a - 135, gauche: null }
  return { droite: 45, gauche: a - 135 }
}

type Props = {
  progression: number
  diametre: number
  epaisseur?: number
  piste?: string
  couleur?: string
  children?: React.ReactNode
  style?: ViewStyle
}

export function AnneauProgression({
  progression,
  diametre,
  epaisseur = 8,
  piste = 'rgba(255, 255, 255, 0.14)',
  couleur = couleurs.or,
  children,
  style,
}: Props) {
  const { droite, gauche } = rotationsPour(progression)
  const cercle: ViewStyle = {
    position: 'absolute',
    width: diametre,
    height: diametre,
    borderRadius: diametre / 2,
    borderWidth: epaisseur,
    borderColor: 'transparent',
    borderTopColor: couleur,
    borderRightColor: couleur,
  }
  return (
    <View
      style={[{ width: diametre, height: diametre }, styles.centre, style]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progression * 100) }}
    >
      <View
        style={[
          styles.absolu,
          {
            width: diametre,
            height: diametre,
            borderRadius: diametre / 2,
            borderWidth: epaisseur,
            borderColor: piste,
          },
        ]}
      />
      <View
        style={[styles.absolu, styles.moitie, { right: 0, width: diametre / 2, height: diametre }]}
      >
        <View style={[cercle, { left: -diametre / 2, transform: [{ rotate: `${droite}deg` }] }]} />
      </View>
      {gauche !== null ? (
        <View
          style={[styles.absolu, styles.moitie, { left: 0, width: diametre / 2, height: diametre }]}
        >
          <View style={[cercle, { left: 0, transform: [{ rotate: `${gauche}deg` }] }]} />
        </View>
      ) : null}
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  absolu: { position: 'absolute', top: 0 },
  moitie: { overflow: 'hidden' },
  centre: { alignItems: 'center', justifyContent: 'center' },
})
