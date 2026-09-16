import { useQueryClient } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Platform, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Bulle } from '@/components/Bulle'
import { EcranChargement, EcranErreur } from '@/components/EcransEtat'
import { TuilesMesures } from '@/components/TuilesMesures'
import { Bouton } from '@/components/ui/Bouton'
import { Icone } from '@/components/ui/Icone'
import { t } from '@/i18n/fr'
import { invaliderArene, messageRefus, publierPrise } from '@/services/arene'
import {
  CLE_CARTE,
  CLE_ETAPE_DU_JOUR,
  useRetour,
  type Retour as DonneesRetour,
} from '@/services/parcours'
import { useCarte } from '@/services/parcours'
import { fermeLActe } from '@/services/rythme'
import { compter } from '@/services/usage'
import { useTheme } from '@/theme/ThemeProvider'
import { couleurs, espaces, polices, rayons, typographie } from '@/theme/tokens'

// B5 · Le retour (B5b with the flags off): Bulle answers "d'après l'analyse", never as
// Rebecca. Counts, never a note on the voice. Drawn as the mockup draws it: Bulle and her
// speech card at the top (the outcome, then what the model noticed outside the grid), the
// three tiles, the axis to work on in a bleu nuit card, what worked on a green strip, the
// grid's lines. When the take validated a step, H2 follows on the same screen (the gold
// medal); when it closed an act, the next button opens H3.

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
  const clientRequetes = useQueryClient()
  const { evaluation, etape, resultat } = retour
  // An Arena or duel take is published from here, and only from here: the second, deliberate
  // gesture of chapter 11. Left unpublished, it stays private and the person records again.
  const publique = retour.type === 'arene' || retour.type === 'duel'
  const [publication, setPublication] = useState<{ enCours: boolean; erreur: string | null }>({
    enCours: false,
    erreur: null,
  })
  const publier = async () => {
    setPublication({ enCours: true, erreur: null })
    try {
      await publierPrise(retour.id)
      compter('arene_prise_publiee', { contexte: retour.type })
      invaliderArene(clientRequetes)
      router.replace(
        retour.type === 'duel' && retour.duel_id ? `/duel/${retour.duel_id}` : '/(onglets)/arene',
      )
    } catch (erreur) {
      setPublication({ enCours: false, erreur: messageRefus(erreur) })
    }
  }
  const carte = useCarte()
  const suivante = etape
    ? (carte.data
        ?.flatMap((a) => a.etapes)
        .find((e) => e.ordre_global === etape.ordre_global + 1) ?? null)
    : null
  const mesures = retour.mesures!

  useEffect(() => {
    compter('retour_ouvert', { type: retour.type, resultat: resultat ?? 'sans' })
    if (resultat === 'etape_validee') compter('defi_valide')
  }, [retour.id, retour.type, resultat])
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
  if (publique) {
    titre = t(retour.type === 'duel' ? 'retour.titreDuel' : 'retour.titreArene')
    corps = t(retour.type === 'duel' ? 'retour.corpsDuel' : 'retour.corpsArene')
  } else if (resultat === 'etape_validee') {
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
  if (publique) {
    // The buttons below are the publish gesture, not a route.
  } else if (resultat === 'etape_validee' && etape) {
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

  const remarques = evaluation?.hors_grille ?? []
  const axes = evaluation?.axes_travail ?? []
  const nomDe = (cle: string) => retour.criteres[cle] ?? cle
  const ombre = theme.sombre ? null : styles.ombre

  return (
    <ScrollView
      style={{ backgroundColor: theme.fond }}
      contentContainerStyle={[
        styles.contenu,
        { paddingTop: insets.top + espaces.l, paddingBottom: insets.bottom + espaces.l },
      ]}
    >
      {resultat === 'etape_validee' ? (
        <View style={styles.medailleBloc}>
          <View style={[styles.halo, { backgroundColor: theme.voixDoux }]}>
            <View style={[styles.medaille, { backgroundColor: theme.voix }]}>
              <Icone sf="checkmark" material="check" taille={30} couleur={couleurs.bleuNuit} />
            </View>
          </View>
        </View>
      ) : null}

      <View style={styles.entete}>
        <Bulle taille="petite" />
        <View style={styles.parole}>
          <Text style={[styles.surtitre, { color: theme.texteTertiaire }]}>
            {t('retour.surtitre')}
          </Text>
          <View style={[styles.bulleCarte, { backgroundColor: theme.carte }, ombre]}>
            <Text style={[styles.titre, { color: theme.texte }]} accessibilityRole="header">
              {titre}
            </Text>
            {corps ? (
              <Text style={[styles.corps, { color: theme.texteSecondaire }]}>{corps}</Text>
            ) : null}
            {remarques.map((remarque) => (
              <Text
                key={remarque.sujet + remarque.remarque}
                style={[styles.corps, { color: theme.texteSecondaire }]}
              >
                {remarque.remarque}
              </Text>
            ))}
          </View>
        </View>
      </View>

      <TuilesMesures mesures={mesures} />

      {axes.length > 0 ? (
        <View style={[styles.levier, { backgroundColor: theme.hero }]}>
          <Text style={[styles.levierEtiquette, { color: theme.voix }]}>{t('retour.axes')}</Text>
          <Text style={[styles.levierTitre, { color: theme.heroTexte }]}>
            {nomDe(axes[0]!.critere)}
          </Text>
          {axes.slice(1).map((axe, index) => (
            <Text
              key={`${axe.critere}-${index}`}
              style={[styles.levierCorps, { color: theme.heroTexteSecondaire }]}
            >
              {nomDe(axe.critere)}
            </Text>
          ))}
        </View>
      ) : null}

      {evaluation && evaluation.points_forts.length > 0 ? (
        <View style={[styles.reussites, { backgroundColor: couleurs.vertDoux }]}>
          <Text style={[styles.reussitesEtiquette, { color: couleurs.vert }]}>
            {t('retour.pointsForts')}
          </Text>
          {evaluation.points_forts.map((point, index) => (
            <View key={`${point.critere}-${index}`} style={styles.reussite}>
              <View style={[styles.puce, { backgroundColor: couleurs.vert }]} />
              <Text style={[styles.reussiteTexte, { color: couleurs.vert }]}>
                {nomDe(point.critere)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {sousNotes.length > 0 ? (
        <View style={[styles.grille, { backgroundColor: theme.carte }, ombre]}>
          <View style={styles.ligne}>
            <Text style={[styles.grilleEtiquette, { color: theme.lien, flex: 1 }]}>
              {t('defi.resultat.entendu')}
            </Text>
            <Text style={[styles.grilleNom, { color: theme.texteTertiaire }]}>
              {t('defi.resultat.grilleLibelle')}
            </Text>
          </View>
          {sousNotes.map(([cle, sousNote]) => {
            const atteint = sousNote.max > 0 && sousNote.score / sousNote.max >= 0.8
            return (
              <View key={cle} style={styles.ligne}>
                <View
                  style={[
                    styles.marqueur,
                    { backgroundColor: atteint ? theme.voix : theme.carteDouce },
                  ]}
                >
                  {atteint ? (
                    <Icone
                      sf="checkmark"
                      material="check"
                      taille={12}
                      couleur={couleurs.bleuNuit}
                    />
                  ) : (
                    <View style={[styles.tiret, { backgroundColor: theme.texteTertiaire }]} />
                  )}
                </View>
                <Text style={[styles.critere, { color: theme.texteSecondaire, flex: 1 }]}>
                  {nomDe(cle)}
                </Text>
                <Text
                  style={[
                    styles.sousNote,
                    { color: atteint ? couleurs.rouge : theme.texteTertiaire },
                  ]}
                >
                  {t('defi.resultat.sousNote', {
                    score: formaterNombre(sousNote.score),
                    max: formaterNombre(sousNote.max),
                  })}
                </Text>
              </View>
            )
          })}
        </View>
      ) : null}

      <View style={styles.actions}>
        {publique ? (
          <>
            {publication.erreur ? (
              <Text style={[typographie.corps, { color: theme.accent }]}>{publication.erreur}</Text>
            ) : null}
            <Bouton
              libelle={t(retour.type === 'duel' ? 'retour.envoyerDuel' : 'retour.publierArene')}
              chargement={publication.enCours}
              onPress={() => void publier()}
            />
            {retour.type === 'arene' ? (
              <Bouton
                libelle={t('retour.garderPourMoi')}
                variante="blanc"
                onPress={() => router.replace('/(onglets)/arene')}
              />
            ) : null}
          </>
        ) : (
          actions.map((action) => (
            <Bouton
              key={action.libelle}
              libelle={action.libelle}
              variante={action.variante ?? 'principal'}
              onPress={() => router.replace(action.cible)}
            />
          ))
        )}
      </View>
    </ScrollView>
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
  contenu: { flexGrow: 1, paddingHorizontal: espaces.xl, gap: 14 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  texteCentre: { textAlign: 'center' },
  // The mockup's card shadow: 0 1px 2px at seven percent.
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
  medailleBloc: { alignItems: 'center', paddingTop: espaces.s },
  halo: { padding: 10, borderRadius: 47 },
  medaille: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entete: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  parole: { flex: 1, gap: 6 },
  surtitre: {
    fontFamily: polices.extraBold,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 0.84,
    textTransform: 'uppercase',
  },
  bulleCarte: {
    paddingVertical: espaces.m,
    paddingHorizontal: 18,
    borderTopLeftRadius: 4,
    borderTopRightRadius: rayons.xxl,
    borderBottomRightRadius: rayons.xxl,
    borderBottomLeftRadius: rayons.xxl,
    gap: espaces.xs,
  },
  titre: { fontFamily: polices.bold, fontSize: 16.5, lineHeight: 24 },
  corps: { fontFamily: polices.medium, fontSize: 14, lineHeight: 21 },
  levier: { padding: espaces.l, borderRadius: rayons.xxxl, gap: espaces.s },
  levierEtiquette: {
    fontFamily: polices.bold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  levierTitre: { fontFamily: polices.extraBold, fontSize: 23, lineHeight: 27, letterSpacing: -0.5 },
  levierCorps: { fontFamily: polices.medium, fontSize: 14, lineHeight: 22 },
  reussites: {
    paddingVertical: espaces.s,
    paddingHorizontal: espaces.m,
    borderRadius: rayons.l,
    gap: espaces.xs,
  },
  reussitesEtiquette: {
    fontFamily: polices.bold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  reussite: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  puce: { width: 8, height: 8, borderRadius: 4 },
  reussiteTexte: { fontFamily: polices.semiBold, fontSize: 13, lineHeight: 18, flex: 1 },
  grille: {
    paddingVertical: espaces.m,
    paddingHorizontal: espaces.l,
    borderRadius: rayons.xxl,
    gap: 10,
  },
  grilleEtiquette: {
    fontFamily: polices.bold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  grilleNom: { fontFamily: polices.bold, fontSize: 11, lineHeight: 15 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  marqueur: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tiret: { width: 8, height: 2.5, borderRadius: 2 },
  critere: { fontFamily: polices.bold, fontSize: 13, lineHeight: 18 },
  sousNote: { fontFamily: polices.extraBold, fontSize: 12.5, lineHeight: 16 },
  actions: { marginTop: 'auto', gap: 10, paddingTop: espaces.l, alignSelf: 'stretch' },
})
