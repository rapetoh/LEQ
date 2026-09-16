import type { Mesures } from '@leq/domaine'
import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native'

import { t } from '@/i18n/fr'
import { useTheme } from '@/theme/ThemeProvider'
import { couleurs, polices, rayons } from '@/theme/tokens'

// The three tiles of B5 as the mockup draws them: white, the number in blue, a small
// uppercase label under it. What is measured, never a note on the voice. Counts only.

export function motLePlusFrequent(mesures: Mesures): { mot: string; fois: number } | null {
  const entrees = Object.entries(mesures.mots_bequilles.par_type)
  if (entrees.length === 0) return null
  const [mot, fois] = entrees.sort((a, b) => b[1] - a[1])[0] as [string, number]
  return { mot, fois }
}

export function TuilesMesures({ mesures }: { mesures: Mesures }) {
  const frequent = motLePlusFrequent(mesures)
  const debit =
    mesures.debit.mots_par_minute === null ? '·' : String(Math.round(mesures.debit.mots_par_minute))
  return (
    <View style={styles.tuiles}>
      <Tuile valeur={debit} libelle={t('retour.motsParMin')} />
      <Tuile
        valeur={String(mesures.mots_bequilles.total)}
        libelle={frequent ? t('retour.bequilleMot', { mot: frequent.mot }) : t('retour.bequilles')}
      />
      <Tuile
        valeur={String(mesures.silences.total)}
        libelle={t('retour.silencesDetail', { tenus: mesures.silences.tenus })}
      />
    </View>
  )
}

function Tuile({ valeur, libelle }: { valeur: string; libelle: string }) {
  const theme = useTheme()
  return (
    <View style={[styles.tuile, { backgroundColor: theme.carte }, !theme.sombre && styles.ombre]}>
      <Text style={[styles.valeur, { color: theme.lien }]}>{valeur}</Text>
      <Text style={[styles.libelle, { color: theme.texteTertiaire }]}>{libelle}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  tuiles: { flexDirection: 'row', gap: 10 },
  tuile: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 13,
    paddingHorizontal: 8,
    borderRadius: rayons.xl,
  },
  ombre: Platform.select({
    ios: {
      shadowColor: couleurs.bleuNuit,
      shadowOpacity: 0.07,
      shadowRadius: 2,
      shadowOffset: { width: 0, height: 1 },
    },
    android: { elevation: 1 },
    default: {},
  }) as ViewStyle,
  valeur: {
    fontFamily: polices.extraBold,
    fontSize: 19,
    lineHeight: 24,
    fontVariant: ['tabular-nums'],
  },
  libelle: {
    fontFamily: polices.bold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
})
