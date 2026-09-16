import { StyleSheet, Text, View } from 'react-native'

import { Titre } from '@/components/ui/Titre'
import { useTheme } from '@/theme/ThemeProvider'
import { couleurs, espaces, polices, rayons, typographie } from '@/theme/tokens'

// The head of a défi as the mockup draws it on B3: two tinted pills (the format and the
// minutes in orange on its pale tint, the points in blue on its pale tint), the 34 point
// title, then one line with the dots of the act (done in gold, current in orange with its
// halo, to come in grey) and where the défi sits in the act, in blue. On the orange hero card
// of B1 the texts turn white.

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
  const secondaire = surFondAccent ? 'rgba(255, 255, 255, 0.85)' : theme.lien
  return (
    <View style={styles.bloc}>
      <View style={styles.pilules}>
        <View
          style={[
            styles.pilule,
            { backgroundColor: surFondAccent ? couleurs.bleuNuit : theme.accentDoux },
          ]}
        >
          <Text
            style={[styles.textePilule, { color: surFondAccent ? couleurs.blanc : couleurs.rouge }]}
          >
            {surtitre}
          </Text>
        </View>
        <View
          style={[
            styles.pilule,
            { backgroundColor: surFondAccent ? couleurs.bleuNuit : theme.carteDouce },
          ]}
        >
          <Text
            style={[styles.textePilule, { color: surFondAccent ? couleurs.blanc : theme.lien }]}
          >
            {points}
          </Text>
        </View>
      </View>
      <Titre
        niveau={niveau === 'ecran' ? 'hero' : 'section'}
        style={[niveau === 'ecran' && styles.titreEcran, { color: texte }]}
      >
        {titre}
      </Titre>
      <View style={styles.ligne} accessibilityLabel={position}>
        {progression && progression.total > 1 ? (
          <View style={styles.points}>
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
                    courant && {
                      borderColor: surFondAccent
                        ? 'rgba(255, 255, 255, 0.45)'
                        : couleurs.orangeClair,
                    },
                    {
                      backgroundColor: courant
                        ? surFondAccent
                          ? couleurs.blanc
                          : theme.accent
                        : fait
                          ? couleurs.or
                          : surFondAccent
                            ? 'rgba(255, 255, 255, 0.4)'
                            : theme.bordure,
                    },
                  ]}
                />
              )
            })}
          </View>
        ) : null}
        <Text style={[styles.position, { color: secondaire }]} numberOfLines={1}>
          {position}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  bloc: { gap: espaces.s },
  pilules: { flexDirection: 'row', alignItems: 'center', gap: espaces.xs },
  pilule: {
    paddingHorizontal: espaces.s,
    paddingVertical: 7,
    borderRadius: rayons.pilule,
  },
  textePilule: {
    ...typographie.etiquette,
    fontFamily: polices.extraBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.66,
    textTransform: 'uppercase',
  },
  titreEcran: { marginTop: espaces.xs },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  points: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  point: { width: 8, height: 8, borderRadius: 4 },
  pointCourant: { width: 15, height: 15, borderRadius: 7.5, borderWidth: 2.5, margin: -2.5 },
  position: { fontFamily: polices.extraBold, fontSize: 12, lineHeight: 16, flexShrink: 1 },
})
