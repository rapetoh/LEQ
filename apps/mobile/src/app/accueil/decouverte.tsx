import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Bulle, type VisageBulle } from '@/components/Bulle'
import { CielEtoile } from '@/components/CielEtoile'
import { Bouton } from '@/components/ui/Bouton'
import { Titre } from '@/components/ui/Titre'
import { t, type CleTexte } from '@/i18n/fr'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, rayons, typographie } from '@/theme/tokens'

// A1b · Comment ça marche. Three screens between the welcome and the microphone, asked for after
// the meeting of 12 September: people arrive on an application that records their voice and
// nothing has told them what it will do with it or what the week looks like.
//
// One idea per screen, in the order someone meets them: the challenge of the day, the feedback,
// the Arena. Skippable, because the person who already knows should not be made to read it.

const ECRANS: { titre: CleTexte; corps: CleTexte; visage: VisageBulle }[] = [
  { titre: 'decouverte.defi', corps: 'decouverte.defiCorps', visage: 'parle' },
  { titre: 'decouverte.retour', corps: 'decouverte.retourCorps', visage: 'attend' },
  { titre: 'decouverte.arene', corps: 'decouverte.areneCorps', visage: 'sourit' },
]

export default function Decouverte() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [index, setIndex] = useState(0)
  const ecran = ECRANS[index]!
  const dernier = index === ECRANS.length - 1

  const suite = () => {
    if (dernier) router.replace('/accueil/micro')
    else setIndex((i) => i + 1)
  }

  return (
    <View
      style={[
        styles.ecran,
        {
          backgroundColor: theme.hero,
          paddingTop: insets.top + espaces.l,
          paddingBottom: insets.bottom + espaces.l,
        },
      ]}
    >
      <CielEtoile />

      <View style={styles.haut}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/accueil/micro')}
          hitSlop={12}
        >
          <Text style={[typographie.corpsFort, { color: theme.heroTexteSecondaire }]}>
            {t('decouverte.passer')}
          </Text>
        </Pressable>
      </View>

      <View style={styles.centre}>
        <Bulle taille="grande" visage={ecran.visage} />
        <Titre niveau="hero" surFondSombre centre style={styles.titre}>
          {t(ecran.titre)}
        </Titre>
        <Text style={[typographie.corps, styles.corps, { color: theme.heroTexteSecondaire }]}>
          {t(ecran.corps)}
        </Text>
      </View>

      <View style={styles.actions}>
        <View
          style={styles.points}
          accessibilityRole="progressbar"
          accessibilityLabel={t('decouverte.etape', {
            numero: String(index + 1),
            total: String(ECRANS.length),
          })}
        >
          {ECRANS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.point,
                {
                  backgroundColor: i === index ? theme.voix : theme.heroBordure,
                  width: i === index ? 22 : 8,
                },
              ]}
            />
          ))}
        </View>
        <Bouton
          libelle={dernier ? t('decouverte.commencer') : t('commun.continuer')}
          onPress={suite}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  ecran: { flex: 1, paddingHorizontal: espaces.xl },
  haut: { alignItems: 'flex-end' },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: espaces.l },
  titre: { marginTop: espaces.m },
  corps: { textAlign: 'center', maxWidth: 320 },
  actions: { gap: espaces.l },
  points: { flexDirection: 'row', justifyContent: 'center', gap: espaces.xs },
  point: { height: 8, borderRadius: rayons.pilule },
})
