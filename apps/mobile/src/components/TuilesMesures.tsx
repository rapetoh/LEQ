import type { Mesures } from '@leq/domaine'
import { StyleSheet, Text, View } from 'react-native'

import { Carte } from '@/components/ui/Carte'
import { t } from '@/i18n/fr'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, typographie } from '@/theme/tokens'

// The three tiles of B5: what is measured, never a note on the voice. Counts only.

export function motLePlusFrequent(mesures: Mesures): { mot: string; fois: number } | null {
  const entrees = Object.entries(mesures.mots_bequilles.par_type)
  if (entrees.length === 0) return null
  const [mot, fois] = entrees.sort((a, b) => b[1] - a[1])[0] as [string, number]
  return { mot, fois }
}

export function TuilesMesures({ mesures }: { mesures: Mesures }) {
  const theme = useTheme()
  const frequent = motLePlusFrequent(mesures)
  const debit =
    mesures.debit.mots_par_minute === null ? '·' : String(Math.round(mesures.debit.mots_par_minute))
  return (
    <View style={styles.tuiles}>
      <Carte teinte="voix" style={styles.tuile}>
        <Text style={[typographie.chiffre, { color: theme.texte }]}>{debit}</Text>
        <Text style={[typographie.petit, { color: theme.texteSecondaire }]}>
          {t('retour.motsParMin')}
        </Text>
      </Carte>
      <Carte style={styles.tuile}>
        <Text style={[typographie.chiffre, { color: theme.texte }]}>
          {mesures.mots_bequilles.total}
        </Text>
        <Text style={[typographie.petit, { color: theme.texteSecondaire }]}>
          {frequent ? t('retour.bequilleMot', { mot: frequent.mot }) : t('retour.bequilles')}
        </Text>
      </Carte>
      <Carte style={styles.tuile}>
        <Text style={[typographie.chiffre, { color: theme.texte }]}>{mesures.silences.tenus}</Text>
        <Text style={[typographie.petit, { color: theme.texteSecondaire }]}>
          {t('retour.silencesTenus')}
        </Text>
      </Carte>
    </View>
  )
}

const styles = StyleSheet.create({
  tuiles: { flexDirection: 'row', gap: espaces.xs },
  tuile: { flex: 1, alignItems: 'center', gap: espaces.xxs, paddingHorizontal: espaces.xs },
})
