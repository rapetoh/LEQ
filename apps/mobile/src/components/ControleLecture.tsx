import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, type ViewStyle } from 'react-native'

import { AnneauProgression } from '@/components/AnneauProgression'
import { Icone } from '@/components/ui/Icone'
import { t } from '@/i18n/fr'
import { couleurs } from '@/theme/tokens'
import { useTheme } from '@/theme/ThemeProvider'

// The one control that plays a recording, wherever a recording is played: the Arena's ranking,
// one's own passage, a duel's two answers, the pair vote. It carries how far the listening has
// got, so a person always knows where they are in a voice they cannot see.
//
// The progress is counted from the take's own length rather than read from the player, because
// playback is linear and the length is already on every row; the ring resets the moment the
// sound stops, whichever way it stopped.

export type EtatLecture = 'inactif' | 'chargement' | 'lecture'

export function ControleLecture({
  etat,
  depuis = null,
  dureeS,
  onPress,
  diametre = 44,
  couleur,
  surFondSombre = false,
  libelle,
  style,
}: {
  etat: EtatLecture
  /** When this playback started, stamped by the screen that owns the player. */
  depuis?: number | null
  /** Length of the recording, in seconds; without it the ring stays empty and only the icon moves. */
  dureeS?: number | null
  onPress: () => void
  diametre?: number
  couleur?: string
  surFondSombre?: boolean
  /** What a screen reader announces; the state is added to it. */
  libelle: string
  style?: ViewStyle
}) {
  const theme = useTheme()
  const enLecture = etat === 'lecture'
  const instant = useHorloge(enLecture && Boolean(depuis) && Boolean(dureeS))
  const progression =
    enLecture && depuis && dureeS && dureeS > 0
      ? Math.min(1, Math.max(0, (instant - depuis) / 1000 / dureeS))
      : 0
  const fond = couleur ?? theme.lien
  const interieur = diametre - 10
  return (
    <AnneauProgression
      progression={progression}
      diametre={diametre}
      epaisseur={3}
      piste={surFondSombre ? 'rgba(255, 255, 255, 0.18)' : theme.bordure}
      couleur={couleurs.or}
      {...(style ? { style } : {})}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={enLecture ? t('arene.arreter') : libelle}
        accessibilityState={{ busy: etat === 'chargement' }}
        onPress={onPress}
        style={({ pressed }) => [
          styles.cercle,
          {
            width: interieur,
            height: interieur,
            borderRadius: interieur / 2,
            backgroundColor: enLecture ? theme.texte : fond,
          },
          pressed && { opacity: 0.85 },
          etat === 'chargement' && { opacity: 0.6 },
        ]}
      >
        <Icone
          sf={enLecture ? 'stop.fill' : 'play.fill'}
          material={enLecture ? 'stop' : 'play-arrow'}
          taille={Math.round(interieur * 0.45)}
          couleur={couleurs.blanc}
        />
      </Pressable>
    </AnneauProgression>
  )
}

/** A clock that ticks only while something is playing; the ring reads the share from it. */
function useHorloge(actif: boolean): number {
  const [instant, setInstant] = useState(() => Date.now())
  useEffect(() => {
    if (!actif) return
    const battement = setInterval(() => setInstant(Date.now()), 120)
    return () => clearInterval(battement)
  }, [actif])
  return instant
}

const styles = StyleSheet.create({
  cercle: { alignItems: 'center', justifyContent: 'center' },
})
