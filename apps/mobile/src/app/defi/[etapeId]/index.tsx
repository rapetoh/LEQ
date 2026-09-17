import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect } from 'react'
import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native'
import { ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { EcranChargement, EcranErreur } from '@/components/EcransEtat'
import { EnteteDefi } from '@/components/EnteteDefi'
import { Bouton } from '@/components/ui/Bouton'
import { t } from '@/i18n/fr'
import { useEstAnonyme, versCompte } from '@/services/compte'
import { useBrief, useCarte, useEtapeDuJour, type Brief as DonneesBrief } from '@/services/parcours'
import { minutesDe, positionDefi, surtitreFormat } from '@/services/rythme'
import { compter } from '@/services/usage'
import { useTheme } from '@/theme/ThemeProvider'
import { couleurs, espaces, polices, rayons, typographie } from '@/theme/tokens'

// B3 · Le brief du défi, and its H6 (texte) and H7 (long) variants. Same brief from B1
// and from the orange node of the map. Drawn as the mockup draws it: the head with its
// pills, Rebecca's words on a white card next to her portrait, the focus of the feedback
// on a blue card, the supports of the plan as numbered white tiles in a row, then the
// action. The consigne is quoted as Rebecca's words only once she has written it: a
// provisional consigne says so.

export default function Brief() {
  const params = useLocalSearchParams<{ etapeId?: string }>()
  const etapeId = typeof params.etapeId === 'string' ? params.etapeId : null
  const brief = useBrief(etapeId)
  const jour = useEtapeDuJour()
  const router = useRouter()
  const anonyme = useEstAnonyme()
  const carte = useCarte()
  // The path is felt once without an account; from the second challenge an account keeps it.
  const unDefiReleve = (carte.data ?? []).some((acte) =>
    acte.etapes.some((e) => e.statut === 'validee'),
  )

  const etapeOuverte = brief.data?.etape.id ?? null
  useEffect(() => {
    if (etapeOuverte) compter('defi_ouvert', { etape_id: etapeOuverte })
  }, [etapeOuverte])

  if (brief.isPending) return <EcranChargement />
  if (brief.isError) {
    return <EcranErreur message={brief.error.message} reessayer={() => void brief.refetch()} />
  }
  if (!brief.data) return <Message texte={t('defi.introuvable')} />
  const { etape } = brief.data
  if (etape.statut === 'verrouillee') return <Message texte={t('defi.verrouille')} />
  if (etape.statut === 'validee') return <Message texte={t('defi.dejaReleve')} />
  if (anonyme && unDefiReleve) return <Redirect href={versCompte('parcours')} />

  const rythme = jour.data?.rythme
  if (rythme && !rythme.peut_enregistrer && rythme.raison === 'limite_jour') {
    return <Redirect href="/defi/limite" />
  }
  if (rythme && !rythme.peut_enregistrer && rythme.raison === 'limite_essais') {
    return (
      <Message
        titre={t('defi.essaisEpuises.titre')}
        texte={t('defi.essaisEpuises.corps')}
        action={{
          libelle: t('defi.versAujourdhui'),
          onPress: () => router.replace('/(onglets)/aujourdhui'),
        }}
      />
    )
  }

  return <ContenuBrief brief={brief.data} />
}

function ContenuBrief({ brief }: { brief: DonneesBrief }) {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { defi, acte, etape } = brief
  const position = positionDefi(acte, etape.ordre, brief.nb_etapes_acte)
  const ombre = theme.sombre ? null : styles.ombre

  return (
    <ScrollView
      style={{ backgroundColor: theme.fond }}
      contentContainerStyle={[
        styles.contenu,
        { paddingTop: insets.top + espaces.xl, paddingBottom: insets.bottom + espaces.l },
      ]}
    >
      <EnteteDefi
        niveau="ecran"
        surtitre={surtitreFormat(defi.format, defi.duree_max_s)}
        points={t('defi.points', { points: defi.points })}
        titre={defi.titre}
        progression={{ ordre: etape.ordre, total: brief.nb_etapes_acte }}
        position={
          position.genre === 'derniere'
            ? t('defi.dernier', { acte: position.acte })
            : t('defi.position', position)
        }
      />

      <View style={[styles.carte, styles.citation, { backgroundColor: theme.carte }, ombre]}>
        {!defi.provisoire ? (
          <View
            style={[styles.portrait, { backgroundColor: theme.voixDoux, borderColor: couleurs.or }]}
          >
            <Text style={[styles.portraitLettre, { color: theme.texte }]}>R</Text>
          </View>
        ) : null}
        <View style={styles.citationTexte}>
          <Text
            style={[
              styles.etiquetteBleue,
              { color: defi.provisoire ? theme.texteTertiaire : theme.lien },
            ]}
          >
            {defi.provisoire ? t('defi.provisoire') : t('defi.rebeccaDit')}
          </Text>
          <Text style={[styles.consigne, { color: theme.texte }]}>« {defi.consigne} »</Text>
        </View>
      </View>

      {defi.format === 'texte' && defi.texte_a_lire ? (
        <View style={[styles.carte, styles.bloc, { backgroundColor: theme.voixDoux }]}>
          <View style={styles.ligne}>
            <Text style={[styles.etiquetteBleue, { color: theme.texteSecondaire, flex: 1 }]}>
              {defi.provisoire ? t('defi.texteProvisoire') : t('defi.texteChoisi')}
            </Text>
            {defi.duree_lecture_s ? (
              <Text style={[styles.etiquetteBleue, { color: theme.texteTertiaire }]}>
                {t('defi.lecture', { secondes: defi.duree_lecture_s })}
              </Text>
            ) : null}
          </View>
          <Text style={[styles.consigne, { color: theme.texte }]}>« {defi.texte_a_lire} »</Text>
          <Text style={[styles.detail, { color: theme.texteSecondaire }]}>{t('defi.lisLe')}</Text>
        </View>
      ) : null}

      {defi.focus ? (
        <View style={[styles.focus, { backgroundColor: theme.carteDouce }]}>
          <View style={[styles.focusIcone, { backgroundColor: theme.lien }]}>
            <View style={styles.focusAnneau} />
          </View>
          <View style={styles.focusTexte}>
            <Text style={[styles.focusTitre, { color: theme.lien }]}>
              {t('defi.retourRegardera', { focus: defi.focus })}
            </Text>
            {defi.format === 'texte' ? (
              <Text style={[styles.focusDetail, { color: theme.texteSecondaire }]}>
                {t('defi.minuterieApresLecture')}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {defi.format === 'long' ? (
        <View style={[styles.carte, styles.bloc, { backgroundColor: theme.carte }, ombre]}>
          <Etape
            numero={1}
            titre={t('defi.etapeLongue.preparer', {
              minutes: minutesDe(defi.duree_preparation_s ?? 120),
            })}
            detail={t('defi.etapeLongue.preparerDetail')}
          />
          <Etape
            numero={2}
            titre={t('defi.etapeLongue.parler', { minutes: minutesDe(defi.duree_max_s) })}
            detail={t('defi.etapeLongue.parlerDetail')}
          />
          <Etape
            numero={3}
            titre={t('defi.etapeLongue.retour')}
            detail={t('defi.etapeLongue.retourDetail')}
          />
          <Text style={[styles.detail, { color: theme.texteSecondaire }]}>
            {t('defi.longNote')}
          </Text>
        </View>
      ) : null}

      {defi.format !== 'long' && defi.plan.length > 0 ? (
        <View style={styles.appuis}>
          {defi.plan.map((appui, index) => (
            <View
              key={appui.titre}
              style={[styles.appui, { backgroundColor: theme.carte }, ombre]}
              accessibilityLabel={`${index + 1}. ${appui.titre}`}
            >
              <Text style={[styles.appuiNumero, { color: theme.lien }]}>{index + 1}</Text>
              <Text style={[styles.appuiTitre, { color: theme.texte }]}>{appui.titre}</Text>
              {appui.detail ? (
                <Text style={[styles.appuiDetail, { color: theme.texteSecondaire }]}>
                  {appui.detail}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Bouton
          libelle={
            defi.format === 'texte'
              ? t('defi.lireEtParler')
              : defi.format === 'long'
                ? t('defi.preparer', { minutes: minutesDe(defi.duree_preparation_s ?? 120) })
                : t('defi.pret')
          }
          onPress={() => router.push(`/defi/${etape.id}/prise`)}
        />
        <Bouton libelle={t('commun.retour')} variante="texte" onPress={() => router.back()} />
      </View>
    </ScrollView>
  )
}

/** One step of the long format: a blue number, the step, what happens in it. */
function Etape({ numero, titre, detail }: { numero: number; titre: string; detail: string }) {
  const theme = useTheme()
  return (
    <View style={styles.ligne}>
      <Text style={[styles.appuiNumero, styles.numero, { color: theme.lien }]}>{numero}</Text>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.etapeTitre, { color: theme.texte }]}>{titre}</Text>
        <Text style={[styles.detail, { color: theme.texteSecondaire }]}>{detail}</Text>
      </View>
    </View>
  )
}

/** A brief that cannot be shown says why, and offers one way out. */
function Message({
  titre,
  texte,
  action,
}: {
  titre?: string
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
      {titre ? (
        <Text style={[typographie.titreSection, styles.texteCentre, { color: theme.texte }]}>
          {titre}
        </Text>
      ) : null}
      <Text style={[typographie.corps, styles.texteCentre, { color: theme.texteSecondaire }]}>
        {texte}
      </Text>
      <View style={styles.actions}>
        <Bouton
          libelle={action?.libelle ?? t('defi.resultat.carte')}
          onPress={action?.onPress ?? (() => router.replace('/(onglets)/defis'))}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  contenu: { flexGrow: 1, paddingHorizontal: espaces.xl, gap: 14 },
  centre: { flex: 1, justifyContent: 'center' },
  texteCentre: { textAlign: 'center' },
  bloc: { gap: espaces.s },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espaces.s },
  carte: { borderRadius: rayons.xxxl, padding: espaces.l },
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
  citation: { flexDirection: 'row', gap: 14, marginTop: espaces.xs },
  citationTexte: { flex: 1, gap: 6 },
  portrait: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portraitLettre: { fontFamily: polices.extraBold, fontSize: 18, lineHeight: 22 },
  etiquetteBleue: { fontFamily: polices.bold, fontSize: 12, lineHeight: 16 },
  consigne: { fontFamily: polices.semiBold, fontSize: 15.5, lineHeight: 23 },
  detail: { fontFamily: polices.medium, fontSize: 13, lineHeight: 18 },
  focus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 18,
    paddingHorizontal: espaces.l,
    borderRadius: rayons.xxl,
  },
  focusIcone: {
    width: 36,
    height: 36,
    borderRadius: rayons.s,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusAnneau: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2.5,
    borderColor: couleurs.blanc,
  },
  focusTexte: { flex: 1, gap: 2 },
  focusTitre: { fontFamily: polices.extraBold, fontSize: 13.5, lineHeight: 18 },
  focusDetail: { fontFamily: polices.medium, fontSize: 12.5, lineHeight: 17 },
  appuis: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  appui: {
    flexGrow: 1,
    flexBasis: '28%',
    padding: espaces.m,
    borderRadius: rayons.xl,
    gap: espaces.xxs,
  },
  appuiNumero: { fontFamily: polices.extraBold, fontSize: 20, lineHeight: 24 },
  numero: { width: 22 },
  appuiTitre: { fontFamily: polices.semiBold, fontSize: 12.5, lineHeight: 17.5 },
  appuiDetail: { fontFamily: polices.medium, fontSize: 11.5, lineHeight: 15 },
  etapeTitre: { fontFamily: polices.semiBold, fontSize: 15, lineHeight: 20 },
  actions: { marginTop: 'auto', gap: espaces.xs, paddingTop: espaces.l },
})
