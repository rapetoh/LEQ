import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { EcranChargement, EcranErreur } from '@/components/EcransEtat'
import { EnteteDefi } from '@/components/EnteteDefi'
import { Bouton } from '@/components/ui/Bouton'
import { Carte } from '@/components/ui/Carte'
import { t } from '@/i18n/fr'
import { useBrief, useEtapeDuJour, type Brief as DonneesBrief } from '@/services/parcours'
import { minutesDe, positionDefi, surtitreFormat } from '@/services/rythme'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, typographie } from '@/theme/tokens'

// B3 · Le brief du défi, and its H6 (texte) and H7 (long) variants. Same brief from B1
// and from the orange node of the map. The consigne is quoted as Rebecca's words only
// once she has written it: a provisional consigne says so.

export default function Brief() {
  const params = useLocalSearchParams<{ etapeId?: string }>()
  const etapeId = typeof params.etapeId === 'string' ? params.etapeId : null
  const brief = useBrief(etapeId)
  const jour = useEtapeDuJour()
  const router = useRouter()

  if (brief.isPending) return <EcranChargement />
  if (brief.isError) {
    return <EcranErreur message={brief.error.message} reessayer={() => void brief.refetch()} />
  }
  if (!brief.data) return <Message texte={t('defi.introuvable')} />
  const { etape } = brief.data
  if (etape.statut === 'verrouillee') return <Message texte={t('defi.verrouille')} />
  if (etape.statut === 'validee') return <Message texte={t('defi.dejaReleve')} />

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

  return (
    <ScrollView
      style={{ backgroundColor: theme.fond }}
      contentContainerStyle={[
        styles.contenu,
        { paddingTop: insets.top + espaces.xl, paddingBottom: insets.bottom + espaces.xl },
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

      <Carte style={styles.bloc}>
        <View style={styles.ligne}>
          {!defi.provisoire ? (
            <View style={[styles.portrait, { backgroundColor: theme.voixDoux }]}>
              <Text style={[typographie.corpsFort, { color: theme.texte }]}>R</Text>
            </View>
          ) : null}
          <Text style={[typographie.etiquette, { color: theme.texteSecondaire, flex: 1 }]}>
            {defi.provisoire ? t('defi.provisoire') : t('defi.rebeccaDit')}
          </Text>
        </View>
        <Text style={[typographie.titreCarte, { color: theme.texte }]}>« {defi.consigne} »</Text>
      </Carte>

      {defi.format === 'texte' && defi.texte_a_lire ? (
        <Carte teinte="voix" style={styles.bloc}>
          <View style={styles.ligne}>
            <Text style={[typographie.etiquette, { color: theme.texteSecondaire, flex: 1 }]}>
              {defi.provisoire ? t('defi.texteProvisoire') : t('defi.texteChoisi')}
            </Text>
            {defi.duree_lecture_s ? (
              <Text style={[typographie.etiquette, { color: theme.texteTertiaire }]}>
                {t('defi.lecture', { secondes: defi.duree_lecture_s })}
              </Text>
            ) : null}
          </View>
          <Text style={[typographie.corpsFort, { color: theme.texte }]}>
            « {defi.texte_a_lire} »
          </Text>
          <Text style={[typographie.petit, { color: theme.texteSecondaire }]}>
            {t('defi.lisLe')}
          </Text>
        </Carte>
      ) : null}

      {defi.format === 'long' ? (
        <Carte teinte="douce" style={styles.bloc}>
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
          <Text style={[typographie.petit, { color: theme.texteSecondaire }]}>
            {t('defi.longNote')}
          </Text>
        </Carte>
      ) : null}

      {defi.format !== 'long' && defi.plan.length > 0 ? (
        <Carte style={styles.bloc}>
          {defi.plan.map((appui, index) => (
            <Etape key={appui.titre} numero={index + 1} titre={appui.titre} detail={appui.detail} />
          ))}
        </Carte>
      ) : null}

      {defi.focus ? (
        <Carte teinte="orange" style={styles.bloc}>
          <Text style={[typographie.corpsFort, { color: theme.texte }]}>
            {t('defi.retourRegardera', { focus: defi.focus })}
          </Text>
          <Text style={[typographie.petit, { color: theme.texteSecondaire }]}>
            {defi.format === 'texte' ? t('defi.minuterieApresLecture') : t('defi.rienDAutre')}
          </Text>
        </Carte>
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

function Etape({ numero, titre, detail }: { numero: number; titre: string; detail: string }) {
  const theme = useTheme()
  return (
    <View style={styles.ligne}>
      <View style={[styles.numero, { backgroundColor: theme.carte }]}>
        <Text style={[typographie.etiquette, { color: theme.texte }]}>{numero}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[typographie.corpsFort, { color: theme.texte }]}>{titre}</Text>
        <Text style={[typographie.petit, { color: theme.texteSecondaire }]}>{detail}</Text>
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
  contenu: { flexGrow: 1, paddingHorizontal: espaces.xl, gap: espaces.m },
  centre: { flex: 1, justifyContent: 'center' },
  texteCentre: { textAlign: 'center' },
  bloc: { gap: espaces.s },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espaces.s },
  portrait: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numero: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { marginTop: 'auto', gap: espaces.s, paddingTop: espaces.l },
})
