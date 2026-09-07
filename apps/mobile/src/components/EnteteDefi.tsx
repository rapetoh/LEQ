import { StyleSheet, Text, View } from 'react-native'

import { Titre } from '@/components/ui/Titre'
import { useTheme } from '@/theme/ThemeProvider'
import { couleurs, espaces, rayons, typographie } from '@/theme/tokens'

// The head of a défi as the mockup draws it on B1 and B3: two pills (the format and the
// minutes, the points), the title, the dots of the act (done, current, to come), then where
// the défi sits in the act. On the orange hero card of B1 the texts turn white.

type Props = {
  surtitre: string
  points: string
  titre: string
  position: string
  progression?: { ordre: number; total: number }
  niveau?: 'ecran' | 'section'
  surFondAccent?: boolean
}

export function EnteteDefi({
  surtitre,
  points,
  titre,
  position,
  progression,
  niveau = 'section',
  surFondAccent = false,
}: Props) {
  const theme = useTheme()
  const texte = surFondAccent ? couleurs.blanc : theme.texte
  const secondaire = surFondAccent ? 'rgba(255, 255, 255, 0.85)' : theme.texteTertiaire
  const fondPilule = surFondAccent ? couleurs.bleuNuit : theme.carteDouce
  const textePilule = surFondAccent ? couleurs.blanc : theme.texte
  return (
    <View style={styles.bloc}>
      <View style={styles.ligne}>
        <View style={[styles.pilule, { backgroundColor: fondPilule }]}>
          <Text style={[typographie.etiquette, styles.majuscules, { color: textePilule }]}>
            {surtitre}
          </Text>
        </View>
        <View style={{ flex: 1 }} />
        <View
          style={[
            styles.pilule,
            { backgroundColor: surFondAccent ? couleurs.bleuNuit : theme.accent },
          ]}
        >
          <Text style={[typographie.etiquette, styles.majuscules, { color: couleurs.blanc }]}>
            {points}
          </Text>
        </View>
      </View>
      <Titre niveau={niveau} style={{ color: texte }}>
        {titre}
      </Titre>
      {progression && progression.total > 1 ? (
        <View style={styles.points} accessibilityLabel={position}>
          {Array.from({ length: Math.min(progression.total, 12) }, (_v, i) => {
            const numero = i + 1
            const fait = numero < progression.ordre
            const courant = numero === progression.ordre
            return (
              <View
                key={numero}
                style={[
                  styles.point,
                  courant && styles.pointCourant,
                  {
                    backgroundColor: courant
                      ? surFondAccent
                        ? couleurs.blanc
                        : theme.accent
                      : fait
                        ? couleurs.or
                        : surFondAccent
                          ? 'rgba(255, 255, 255, 0.4)'
                          : theme.carteDouce,
                  },
                ]}
              />
            )
          })}
        </View>
      ) : null}
      <Text style={[typographie.petit, { color: secondaire }]}>{position}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  bloc: { gap: espaces.xs },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espaces.s },
  pilule: {
    paddingHorizontal: espaces.s,
    paddingVertical: espaces.xxs,
    borderRadius: rayons.pilule,
  },
  majuscules: { textTransform: 'uppercase' },
  points: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaces.xs,
    paddingVertical: espaces.xxs,
  },
  point: { width: 8, height: 8, borderRadius: 4 },
  pointCourant: { width: 12, height: 12, borderRadius: 6 },
})
