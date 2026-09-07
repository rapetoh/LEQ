import { useQueryClient } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Bulle } from '@/components/Bulle'
import { EcranChargement, EcranErreur } from '@/components/EcransEtat'
import { TuilesMesures } from '@/components/TuilesMesures'
import { Bouton } from '@/components/ui/Bouton'
import { Carte } from '@/components/ui/Carte'
import { Titre } from '@/components/ui/Titre'
import { t } from '@/i18n/fr'
import {
  CLE_CARTE,
  CLE_ETAPE_DU_JOUR,
  useRetour,
  type Retour as DonneesRetour,
} from '@/services/parcours'
import { useCarte } from '@/services/parcours'
import { fermeLActe } from '@/services/rythme'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, typographie } from '@/theme/tokens'

// B5 · Le retour (B5b with the flags off): Bulle answers "d'après l'analyse", never as
// Rebecca. Counts, never a note on the voice. When the take validated a step, H2 follows
// on the same screen; when it closed an act, the next button opens H3.

export default function Retour() {
  const params = useLocalSearchParams<{ tentativeId?: string }>()
  const id = typeof params.tentativeId === 'string' ? params.tentativeId : null
  const retour = useRetour(id)
  const router = useRouter()
  const clientRequetes = useQueryClient()

  // A result changes the step of the day and the map.
  useEffect(() => {
    if (retour.data?.resultat) {
      void clientRequetes.invalidateQueries({ queryKey: CLE_ETAPE_DU_JOUR })
      void clientRequetes.invalidateQueries({ queryKey: CLE_CARTE })
    }
  }, [retour.data?.resultat, clientRequetes])

  if (retour.isPending) return <EcranChargement />
  if (retour.isError) {
    return <EcranErreur message={retour.error.message} reessayer={() => void retour.refetch()} />
  }
  if (!retour.data) return <Vide texte={t('retour.introuvable')} />
  if (retour.data.statut !== 'retour_disponible' || !retour.data.mesures) {
    return (
      <Vide
        texte={t('retour.tropTot')}
        action={{
          libelle: t('retour.suivreAnalyse'),
          onPress: () => router.replace(`/analyse/${retour.data?.id}`),
        }}
      />
    )
  }
  return <ContenuRetour retour={retour.data} />
}

function ContenuRetour({ retour }: { retour: DonneesRetour }) {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { evaluation, etape, resultat } = retour
  const carte = useCarte()
  const suivante = etape
    ? (carte.data
        ?.flatMap((a) => a.etapes)
        .find((e) => e.ordre_global === etape.ordre_global + 1) ?? null)
    : null
  const mesures = retour.mesures!
  const sousNotes = evaluation ? Object.entries(evaluation.sous_notes) : []
  const noteVisible =
    evaluation && evaluation.note_totale !== null && evaluation.note_max !== null
      ? t('defi.resultat.grille', {
          note: formaterNombre(evaluation.note_totale),
          max: formaterNombre(evaluation.note_max),
        })
      : null

  let titre: string
  let corps: string | null = null
  if (resultat === 'etape_validee') {
    titre = t('defi.resultat.reussi')
    corps = [etape?.defi.titre, noteVisible].filter(Boolean).join(' · ')
  } else if (resultat === 'etape_echouee') {
    titre = t('defi.resultat.echoue')
    corps = t('defi.resultat.echoueCorps')
  } else {
    titre = etape?.defi.titre ?? t('prise.surtitre')
    corps = t('defi.resultat.grilleAttend')
  }

  const actions: { libelle: string; cible: string; variante?: 'secondaire' | 'texte' }[] = []
  if (resultat === 'etape_validee' && etape) {
    if (fermeLActe(retour)) {
      actions.push({ libelle: t('commun.continuer'), cible: `/acte/${etape.acte_id}/traverse` })
    } else if (suivante) {
      actions.push({
        libelle: t('defi.resultat.suivant', { titre: suivante.defi.titre }),
        cible: `/defi/${suivante.id}`,
      })
      actions.push({
        libelle: t('defi.resultat.carte'),
        cible: '/(onglets)/defis',
        variante: 'texte',
      })
    } else {
      actions.push({ libelle: t('defi.resultat.carte'), cible: '/(onglets)/defis' })
    }
    if (!suivante || fermeLActe(retour)) {
      actions.push({
        libelle: t('defi.versAujourdhui'),
        cible: '/(onglets)/aujourdhui',
        variante: 'texte',
      })
    }
  } else if (resultat === 'etape_echouee' && etape) {
    if (etape.rattrapage_propose) {
      actions.push({
        libelle: t('defi.resultat.exerciceDabord'),
        cible: `/defi/${etape.id}/rattrapage`,
      })
    } else {
      actions.push({ libelle: t('defi.resultat.retenter'), cible: `/defi/${etape.id}` })
    }
    actions.push({
      libelle: t('defi.versAujourdhui'),
      cible: '/(onglets)/aujourdhui',
      variante: 'texte',
    })
  } else {
    actions.push({ libelle: t('defi.versAujourdhui'), cible: '/(onglets)/aujourdhui' })
    actions.push({
      libelle: t('defi.resultat.carte'),
      cible: '/(onglets)/defis',
      variante: 'texte',
    })
  }

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
        <Text style={[typographie.etiquette, { color: theme.texteTertiaire, flex: 1 }]}>
          {t('retour.surtitre')}
        </Text>
      </View>
      <Titre niveau="ecran">{titre}</Titre>
      {corps ? (
        <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>{corps}</Text>
      ) : null}

      <Text style={[typographie.etiquette, styles.section, { color: theme.texteTertiaire }]}>
        {t('retour.mesure')}
      </Text>
      <TuilesMesures mesures={mesures} />

      {sousNotes.length > 0 ? (
        <Carte style={styles.bloc}>
          <View style={styles.ligne}>
            <Text style={[typographie.titreCarte, { color: theme.texte, flex: 1 }]}>
              {t('defi.resultat.entendu')}
            </Text>
            <Text style={[typographie.etiquette, { color: theme.texteTertiaire }]}>
              {t('defi.resultat.grilleLibelle')}
            </Text>
          </View>
          {sousNotes.map(([cle, sousNote]) => (
            <View key={cle} style={styles.ligne}>
              <Text style={[typographie.corps, { color: theme.texte, flex: 1 }]}>
                {retour.criteres[cle] ?? cle}
              </Text>
              <Text style={[typographie.corpsFort, { color: theme.texte }]}>
                {t('defi.resultat.sousNote', {
                  score: formaterNombre(sousNote.score),
                  max: formaterNombre(sousNote.max),
                })}
              </Text>
            </View>
          ))}
        </Carte>
      ) : null}

      {evaluation && evaluation.points_forts.length > 0 ? (
        <Liste
          titre={t('retour.pointsForts')}
          points={evaluation.points_forts}
          criteres={retour.criteres}
          teinte="voix"
        />
      ) : null}
      {evaluation && evaluation.axes_travail.length > 0 ? (
        <Liste
          titre={t('retour.axes')}
          points={evaluation.axes_travail}
          criteres={retour.criteres}
          teinte="douce"
        />
      ) : null}

      <View style={styles.actions}>
        {actions.map((action) => (
          <Bouton
            key={action.libelle}
            libelle={action.libelle}
            variante={action.variante ?? 'principal'}
            onPress={() => router.replace(action.cible)}
          />
        ))}
      </View>
    </ScrollView>
  )
}

function Liste({
  titre,
  points,
  criteres,
  teinte,
}: {
  titre: string
  points: readonly { critere: string }[]
  criteres: Record<string, string>
  teinte: 'voix' | 'douce'
}) {
  const theme = useTheme()
  return (
    <Carte teinte={teinte} style={styles.bloc}>
      <Text style={[typographie.titreCarte, { color: theme.texte }]}>{titre}</Text>
      {points.map((point, index) => (
        <Text
          key={`${point.critere}-${index}`}
          style={[typographie.corps, { color: theme.texteSecondaire }]}
        >
          {criteres[point.critere] ?? point.critere}
        </Text>
      ))}
    </Carte>
  )
}

function Vide({
  texte,
  action,
}: {
  texte: string
  action?: { libelle: string; onPress: () => void }
}) {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  return (
    <View
      style={[
        styles.contenu,
        styles.centre,
        {
          backgroundColor: theme.fond,
          paddingTop: insets.top + espaces.xl,
          paddingBottom: insets.bottom + espaces.xl,
        },
      ]}
    >
      <Bulle taille="moyenne" calme />
      <Text style={[typographie.corps, styles.texteCentre, { color: theme.texteSecondaire }]}>
        {texte}
      </Text>
      <View style={styles.actions}>
        {action ? <Bouton libelle={action.libelle} onPress={action.onPress} /> : null}
        <Bouton
          libelle={t('defi.versAujourdhui')}
          variante={action ? 'texte' : 'principal'}
          onPress={() => router.replace('/(onglets)/aujourdhui')}
        />
      </View>
    </View>
  )
}

/** "25" or "12,5": French decimal comma through Intl. */
export function formaterNombre(valeur: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(valeur)
}

const styles = StyleSheet.create({
  contenu: { flexGrow: 1, paddingHorizontal: espaces.xl, gap: espaces.m },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  texteCentre: { textAlign: 'center' },
  entete: { flexDirection: 'row', alignItems: 'center', gap: espaces.s },
  section: { marginTop: espaces.s },
  bloc: { gap: espaces.s },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espaces.s },
  actions: { marginTop: 'auto', gap: espaces.s, paddingTop: espaces.l, alignSelf: 'stretch' },
})
