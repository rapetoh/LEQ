import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Bulle } from '@/components/Bulle'
import { EcranChargement, EcranErreur } from '@/components/EcransEtat'
import { Bouton } from '@/components/ui/Bouton'
import { Carte } from '@/components/ui/Carte'
import { Titre } from '@/components/ui/Titre'
import { t } from '@/i18n/fr'
import {
  CLE_CARTE,
  CLE_ETAPE_DU_JOUR,
  chargerExercice,
  cleBrief,
  marquerRattrapageVu,
  useBrief,
} from '@/services/parcours'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, typographie } from '@/theme/tokens'

// X5 · Le rattrapage. Never three failures in a row: between two tries, a lower step.
// The défi waits, the streak does not break. Both ways out mark the proposal as seen.

export default function Rattrapage() {
  const params = useLocalSearchParams<{ etapeId?: string }>()
  const etapeId = typeof params.etapeId === 'string' ? params.etapeId : null
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const clientRequetes = useQueryClient()
  const brief = useBrief(etapeId)
  const competence = brief.data?.defi.competence ?? null
  const exercice = useQuery({
    queryKey: ['exercice', competence],
    queryFn: () => chargerExercice(competence ?? ''),
    enabled: competence !== null,
    staleTime: 60_000,
  })
  const [enCours, setEnCours] = useState(false)

  if (brief.isPending || (competence !== null && exercice.isPending)) return <EcranChargement />
  if (brief.isError || !brief.data) {
    return (
      <EcranErreur
        message={brief.error?.message ?? t('defi.introuvable')}
        reessayer={() => void brief.refetch()}
      />
    )
  }
  const { defi, etape } = brief.data

  const sortir = async (cible: string) => {
    if (enCours) return
    setEnCours(true)
    try {
      await marquerRattrapageVu(etape.id)
    } catch (erreur) {
      console.warn('rattrapage: non marqué, réessayé au prochain passage', erreur)
    }
    void clientRequetes.invalidateQueries({ queryKey: CLE_ETAPE_DU_JOUR })
    void clientRequetes.invalidateQueries({ queryKey: CLE_CARTE })
    void clientRequetes.invalidateQueries({ queryKey: cleBrief(etape.id) })
    router.replace(cible)
  }

  const ex = exercice.data ?? null

  return (
    <ScrollView
      style={{ backgroundColor: theme.fond }}
      contentContainerStyle={[
        styles.contenu,
        { paddingTop: insets.top + espaces.xl, paddingBottom: insets.bottom + espaces.xl },
      ]}
    >
      <View style={styles.entete}>
        <Bulle taille="petite" />
        <Titre niveau="ecran">{t('defi.rattrapage.titre')}</Titre>
      </View>
      <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
        {t('defi.rattrapage.corps', { titre: defi.titre })}
      </Text>

      {ex ? (
        <Carte teinte="voix" style={styles.bloc}>
          <Text style={[typographie.chiffre, { color: theme.texte }]}>
            {t('defi.rattrapage.duree', { secondes: ex.duree_s })}
          </Text>
          <Text style={[typographie.corpsFort, { color: theme.texte }]}>{ex.titre}</Text>
          <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>{ex.consigne}</Text>
          {ex.provisoire ? (
            <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>
              {t('defi.provisoire')}
            </Text>
          ) : null}
        </Carte>
      ) : (
        <Carte teinte="douce" style={styles.bloc}>
          <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
            {t('defi.rattrapage.exerciceIndisponible')}
          </Text>
        </Carte>
      )}

      <View style={styles.actions}>
        {ex ? (
          <Bouton
            libelle={t('defi.rattrapage.faire', { secondes: ex.duree_s })}
            chargement={enCours}
            onPress={() => void sortir(`/defi/${etape.id}/exercice?exerciceId=${ex.id}`)}
          />
        ) : null}
        <Bouton
          libelle={t('defi.rattrapage.retenter')}
          variante={ex ? 'secondaire' : 'principal'}
          chargement={enCours}
          onPress={() => void sortir(`/defi/${etape.id}`)}
        />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  contenu: { flexGrow: 1, paddingHorizontal: espaces.xl, gap: espaces.m },
  entete: { flexDirection: 'row', alignItems: 'center', gap: espaces.s },
  bloc: { gap: espaces.xs },
  actions: { marginTop: 'auto', gap: espaces.s, paddingTop: espaces.l },
})
