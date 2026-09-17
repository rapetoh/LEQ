import { Image, StyleSheet, Text, View } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

import { Icone } from '@/components/ui/Icone'
import { useTheme } from '@/theme/ThemeProvider'
import { couleurs, polices } from '@/theme/tokens'

// The person: their picture when they put one on their account, else the first letter of their
// name on warm gold, else a neutral mark (a pseudonym in the ranking, an account with no name).
// The flame of a running streak sits at the corner as the mockup places it (G1).

export function Avatar({
  prenom,
  uri = null,
  taille = 64,
  flamme = false,
}: {
  prenom: string | null
  /** The public URL of the picture; null draws the letter or the mark. */
  uri?: string | null
  taille?: number
  flamme?: boolean
}) {
  const theme = useTheme()
  const badge = Math.round(taille * 0.4)
  return (
    <View style={{ width: taille, height: taille }}>
      <View style={[styles.rond, { width: taille, height: taille, borderRadius: taille / 2 }]}>
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id="or" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={couleurs.or} />
              <Stop offset="1" stopColor={couleurs.orange} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#or)" />
        </Svg>
        {uri ? (
          <Image
            source={{ uri }}
            style={{ width: taille, height: taille }}
            resizeMode="cover"
            accessible={false}
          />
        ) : prenom ? (
          <Text style={[styles.lettre, { fontSize: taille * 0.42, lineHeight: taille * 0.5 }]}>
            {prenom.charAt(0).toUpperCase()}
          </Text>
        ) : (
          <Icone
            sf="person.fill"
            material="person"
            taille={Math.round(taille * 0.46)}
            couleur={couleurs.blanc}
          />
        )}
      </View>
      {flamme ? (
        <View
          style={[
            styles.badge,
            {
              width: badge,
              height: badge,
              borderRadius: badge / 2,
              backgroundColor: couleurs.orange,
              borderColor: theme.fond,
            },
          ]}
        >
          <Icone
            sf="flame.fill"
            material="local-fire-department"
            taille={Math.round(badge * 0.55)}
            couleur={couleurs.or}
          />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  rond: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  lettre: { fontFamily: polices.extraBold, color: couleurs.blanc },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
