import { useQuery } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Bulle } from '@/components/Bulle'
import { EcranChargement, EcranErreur } from '@/components/EcransEtat'
import { formaterDuree } from '@/components/EcranPrise'
import { Bouton } from '@/components/ui/Bouton'
import { Carte } from '@/components/ui/Carte'
import { Titre } from '@/components/ui/Titre'
import { t } from '@/i18n/fr'
import { chargerExerciceParId } from '@/services/parcours'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, typographie } from '@/theme/tokens'

// The short exercise of X5: a timed practice, out loud, with Bulle listening and nothing
// recorded. It does not count as a step and is not analysed (docs/OPEN-INPUTS.md asks
// Rebecca whether it should be). Then back to the défi.

type Phase = 'pret' | 'en_cours' | 'fait'

export default function Exercice() {
  const params = useLocalSearchParams<{ etapeId?: string; exerciceId?: string }>()
  const etapeId = typeof params.etapeId === 'string' ? params.etapeId : null
  const exerciceId = typeof params.exerciceId === 'string' ? params.exerciceId : null
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const exercice = useQuery({
    queryKey: ['exercice_par_id', exerciceId],
    queryFn: () => chargerExerciceParId(exerciceId ?? ''),
    enabled: exerciceId !== null,
  })
  const [phase, setPhase] = useState<Phase>('pret')
  const [restant, setRestant] = useState<number | null>(null)

  useEffect(() => {
    if (phase !== 'en_cours') return
    const compteur = setInterval(() => {
      setRestant((valeur) => {
        if (valeur === null) return null
        if (valeur <= 1) {
          clearInterval(compteur)
          setPhase('fait')
          return 0
        }
        return valeur - 1
      })
    }, 1000)
    return () => clearInterval(compteur)
  }, [phase])

  if (exercice.isPending) return <EcranChargement />
  if (exercice.isError || !exercice.data) {
    return (
      <EcranErreur
        message={exercice.error?.message ?? t('defi.rattrapage.exerciceIndisponible')}
        reessayer={() => void exercice.refetch()}
      />
    )
  }
  const ex = exercice.data
  const revenir = () => router.replace(etapeId ? `/defi/${etapeId}` : '/(onglets)/aujourdhui')

  return (
    <ScrollView
      style={{ backgroundColor: theme.fond }}
      contentContainerStyle={[
        styles.contenu,
        { paddingTop: insets.top + espaces.xl, paddingBottom: insets.bottom + espaces.xl },
      ]}
    >
      <Text style={[typographie.etiquette, { color: theme.texteTertiaire }]}>
        {t('defi.rattrapage.duree', { secondes: ex.duree_s })}
      </Text>
      <Titre niveau="ecran">
        {phase === 'fait' ? t('defi.rattrapage.termineTitre') : ex.titre}
      </Titre>
      <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
        {phase === 'fait' ? t('defi.rattrapage.termineCorps') : ex.consigne}
      </Text>

      <View style={styles.centre}>
        <Bulle taille="petite" calme={phase === 'en_cours'} />
        {phase === 'en_cours' ? (
          <>
            <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>
              {t('defi.rattrapage.enCours')}
            </Text>
            <Text style={[typographie.chiffre, { color: theme.texte }]}>
              {formaterDuree(restant ?? ex.duree_s)}
            </Text>
          </>
        ) : null}
      </View>

      {ex.provisoire && phase !== 'fait' ? (
        <Carte teinte="douce">
          <Text style={[typographie.petit, { color: theme.texteSecondaire }]}>
            {t('defi.provisoire')}
          </Text>
        </Carte>
      ) : null}

      <View style={styles.actions}>
        {phase === 'pret' ? (
          <Bouton
            libelle={t('defi.rattrapage.commencer')}
            onPress={() => {
              setRestant(ex.duree_s)
              setPhase('en_cours')
            }}
          />
        ) : null}
        {phase === 'en_cours' ? (
          <Bouton
            libelle={t('defi.rattrapage.fait')}
            variante="secondaire"
            onPress={() => setPhase('fait')}
          />
        ) : null}
        {phase === 'fait' ? (
          <Bouton libelle={t('defi.rattrapage.retourDefi')} onPress={revenir} />
        ) : null}
        {phase !== 'fait' ? (
          <Bouton libelle={t('defi.rattrapage.retourDefi')} variante="texte" onPress={revenir} />
        ) : null}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  contenu: { flexGrow: 1, paddingHorizontal: espaces.xl, gap: espaces.m },
  centre: { alignItems: 'center', gap: espaces.s, marginTop: espaces.l },
  actions: { marginTop: 'auto', gap: espaces.s, paddingTop: espaces.l },
})
