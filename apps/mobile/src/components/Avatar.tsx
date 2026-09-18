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

/**
 * Two people facing each other, drawn the way a head-to-head is drawn everywhere: the two
 * pictures overlapping on a diagonal, the other person in front. The letter or the neutral mark
 * stands in for whoever has no photo yet.
 */
export function AvatarsDuel({
  moi,
  lui,
  taille = 34,
}: {
  moi: { prenom: string | null; uri: string | null }
  /** Null while nobody has joined: the empty seat is drawn as a dotted ring. */
  lui: { prenom: string | null; uri: string | null } | null
  taille?: number
}) {
  const theme = useTheme()
  const recouvrement = Math.round(taille * 0.34)
  const largeur = taille * 2 - recouvrement
  const decalage = Math.round(taille * 0.16)
  return (
    <View style={{ width: largeur, height: taille + decalage }} accessible={false}>
      <View style={[styles.face, { top: decalage, left: 0 }]}>
        <View style={[styles.liseré, { borderColor: theme.carte, borderRadius: taille }]}>
          <Avatar prenom={moi.prenom} uri={moi.uri} taille={taille} />
        </View>
      </View>
      <View style={[styles.face, { top: 0, left: taille - recouvrement }]}>
        <View style={[styles.liseré, { borderColor: theme.carte, borderRadius: taille }]}>
          {lui ? (
            <Avatar prenom={lui.prenom} uri={lui.uri} taille={taille} />
          ) : (
            <View
              style={[
                styles.libre,
                {
                  width: taille,
                  height: taille,
                  borderRadius: taille / 2,
                  borderColor: theme.bordure,
                  backgroundColor: theme.carteDouce,
                },
              ]}
            >
              <Icone
                sf="person.badge.plus"
                material="person-add"
                taille={Math.round(taille * 0.5)}
                couleur={theme.texteTertiaire}
              />
            </View>
          )}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  rond: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  face: { position: 'absolute' },
  liseré: { borderWidth: 2.5, overflow: 'hidden' },
  libre: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
