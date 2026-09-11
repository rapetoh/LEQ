import { useLocalSearchParams, useRouter } from 'expo-router'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Bulle } from '@/components/Bulle'
import { EcranChargement, EcranErreur } from '@/components/EcransEtat'
import { Bouton } from '@/components/ui/Bouton'
import { Carte } from '@/components/ui/Carte'
import { Titre } from '@/components/ui/Titre'
import { t } from '@/i18n/fr'
import { messageRefus, usePodium } from '@/services/arene'
import { HAUTEURS, maLigne, marches, reste, type Marche } from '@/services/podiumVue'
import { useTheme } from '@/theme/ThemeProvider'
import { couleurs, espaces, rayons, typographie } from '@/theme/tokens'

// C8 · Le podium. The week is over, the votes are counted, the recordings are gone. What is
// left is the ranking, and the only thing that matters to the person: where they landed.
// A bleu nuit screen, like every moment of the app that is meant to be felt.

const HAUTEUR_MARCHE = 132

export default function Podium() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { sujetId } = useLocalSearchParams<{ sujetId: string }>()
  const podium = usePodium(sujetId ?? '')

  if (podium.isPending) return <EcranChargement />
  if (podium.isError) {
    return (
      <EcranErreur message={messageRefus(podium.error)} reessayer={() => void podium.refetch()} />
    )
  }

  const classement = podium.data?.classement.classement ?? []
  const sujet = podium.data?.sujet ?? null
  const mienne = maLigne(classement)
  const suite = reste(classement)

  return (
    <ScrollView
      style={{ backgroundColor: theme.hero }}
      contentContainerStyle={[
        styles.contenu,
        { paddingTop: insets.top + espaces.xl, paddingBottom: insets.bottom + espaces.xxl },
      ]}
    >
      <View style={styles.entete}>
        <Bulle taille="moyenne" visage="sourit" calme />
        <Text style={[typographie.etiquette, styles.majuscules, { color: theme.voix }]}>
          {t('arene.podiumSurtitre')}
        </Text>
        <Titre niveau="ecran" surFondSombre centre>
          {t('arene.podiumTitre')}
        </Titre>
        <Text style={[typographie.corps, styles.centre, { color: theme.heroTexteSecondaire }]}>
          {t('arene.podiumSousTitre')}
        </Text>
      </View>

      {sujet ? (
        <Carte teinte="sombre" style={styles.bloc}>
          <Text style={[typographie.etiquette, styles.majuscules, { color: theme.voix }]}>
            {t('arene.podiumSujet')}
          </Text>
          <Titre niveau="section" surFondSombre>
            {sujet.texte}
          </Titre>
        </Carte>
      ) : null}

      {classement.length === 0 ? (
        <Carte teinte="sombre" style={styles.bloc}>
          <Text style={[typographie.corps, { color: theme.heroTexteSecondaire }]}>
            {t('arene.podiumVide')}
          </Text>
        </Carte>
      ) : (
        <View style={styles.podium}>
          {marches(classement).map((marche) => (
            <MarchePodium key={marche.rang} marche={marche} />
          ))}
        </View>
      )}

      <Carte teinte={mienne ? 'voix' : 'sombre'} style={styles.bloc}>
        <Text
          style={[
            typographie.etiquette,
            styles.majuscules,
            { color: mienne ? theme.texteSecondaire : theme.voix },
          ]}
        >
          {t('arene.podiumTaPlace')}
        </Text>
        {mienne ? (
          <>
            <Text style={[typographie.chiffre, { color: theme.texte }]}>
              {mienne.rang === 1
                ? t('arene.podiumRangPremier', { total: classement.length })
                : t('arene.podiumRang', { rang: mienne.rang, total: classement.length })}
            </Text>
            <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
              {mienne.votes === 0
                ? t('arene.podiumPasDeVoix')
                : mienne.votes === 1
                  ? t('arene.podiumVotesUn')
                  : t('arene.podiumVotes', { votes: mienne.votes })}
            </Text>
          </>
        ) : (
          <>
            <Titre niveau="carte" surFondSombre>
              {t('arene.podiumPasParle')}
            </Titre>
            <Text style={[typographie.corps, { color: theme.heroTexteSecondaire }]}>
              {t('arene.podiumPasParleCorps')}
            </Text>
          </>
        )}
      </Carte>

      {suite.length > 0 ? (
        <View style={styles.bloc}>
          <Text style={[typographie.etiquette, styles.majuscules, { color: theme.voix }]}>
            {t('arene.podiumSuite')}
          </Text>
          <Carte teinte="sombre" style={styles.liste}>
            {suite.map((ligne, index) => (
              <View
                key={ligne.prise_id}
                style={[
                  styles.ligne,
                  index > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: theme.heroBordure,
                  },
                ]}
              >
                <Text
                  style={[typographie.corpsFort, styles.rang, { color: theme.heroTexteSecondaire }]}
                >
                  {ligne.rang}
                </Text>
                <Text style={[typographie.corpsFort, styles.nom, { color: theme.heroTexte }]}>
                  {ligne.moi ? t('arene.moi') : ligne.nom}
                </Text>
                <Text style={[typographie.petit, { color: theme.heroTexteSecondaire }]}>
                  {ligne.votes === 1 ? t('arene.voteUn') : t('arene.votes', { votes: ligne.votes })}
                </Text>
              </View>
            ))}
          </Carte>
        </View>
      ) : null}

      <Text style={[typographie.petit, styles.centre, { color: theme.heroTexteSecondaire }]}>
        {t('arene.podiumAudio')}
      </Text>

      <View style={styles.actions}>
        <Bouton libelle={t('commun.retour')} variante="secondaire" onPress={() => router.back()} />
      </View>
    </ScrollView>
  )
}

/** One step: the name above, a gold block whose height says the place, the number inside. */
function MarchePodium({ marche }: { marche: Marche }) {
  const theme = useTheme()
  const premier = marche.rang === 1
  const vide = marche.ligne === null
  return (
    <View style={styles.marche}>
      <Text
        numberOfLines={1}
        style={[
          typographie.petit,
          styles.centre,
          { color: vide ? theme.heroTexteSecondaire : theme.heroTexte },
        ]}
      >
        {vide ? '' : marche.ligne?.moi ? t('arene.moi') : marche.ligne?.nom}
      </Text>
      <Text style={[typographie.petit, styles.centre, { color: theme.heroTexteSecondaire }]}>
        {vide
          ? ''
          : marche.ligne?.votes === 1
            ? t('arene.voteUn')
            : t('arene.votes', { votes: marche.ligne?.votes ?? 0 })}
      </Text>
      <View
        style={[
          styles.bloc3,
          {
            height: HAUTEUR_MARCHE * HAUTEURS[marche.rang],
            backgroundColor: vide
              ? 'rgba(255, 255, 255, 0.08)'
              : premier
                ? couleurs.or
                : 'rgba(255, 189, 89, 0.35)',
          },
        ]}
      >
        <Text
          style={[
            typographie.chiffre,
            { color: premier && !vide ? couleurs.bleuNuit : theme.heroTexte },
          ]}
        >
          {marche.rang}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  contenu: { flexGrow: 1, paddingHorizontal: espaces.xl, gap: espaces.m },
  entete: { alignItems: 'center', gap: espaces.xs },
  centre: { textAlign: 'center' },
  majuscules: { textTransform: 'uppercase' },
  bloc: { gap: espaces.xs },
  podium: { flexDirection: 'row', alignItems: 'flex-end', gap: espaces.xs, marginTop: espaces.s },
  marche: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: espaces.xxs },
  bloc3: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: rayons.m,
    borderTopRightRadius: rayons.m,
  },
  liste: { gap: 0, paddingVertical: 0 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espaces.s, paddingVertical: espaces.s },
  rang: { width: 28 },
  nom: { flex: 1 },
  actions: { marginTop: 'auto', paddingTop: espaces.l },
})
