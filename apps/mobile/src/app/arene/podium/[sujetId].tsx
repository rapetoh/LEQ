import type { LigneClassement } from '@leq/domaine'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Avatar } from '@/components/Avatar'
import { useBarreEtatClaire } from '@/components/BarreEtat'
import { EcranChargement, EcranErreur } from '@/components/EcransEtat'
import { Couronne } from '@/components/Couronne'
import { Medaille, METAUX, type Place } from '@/components/Medaille'
import { Bouton } from '@/components/ui/Bouton'
import { Degrade } from '@/components/ui/Degrade'
import { Icone } from '@/components/ui/Icone'
import { t } from '@/i18n/fr'
import { useActualisation } from '@/services/actualisation'
import { messageRefus, usePodium } from '@/services/arene'
import { urlAvatar } from '@/services/photo'
import { HAUTEURS, maLigne, marches, reste, type Marche } from '@/services/podiumVue'
import { FondSombre } from '@/theme/FondSombre'
import { useTheme } from '@/theme/ThemeProvider'
import { couleurs, espaces, polices, rayons, typographie } from '@/theme/tokens'

// C8 · Le podium. The week is over, the votes are counted, the recordings are gone. What is left
// is who carried it, and where the person landed. It holds to one screen without scrolling: the
// rest of the ranking is one tap away rather than below the fold, and the sizes step down on a
// short phone.
//
// The three of a closed week are named and carry their picture whatever they chose, because the
// votes are closed and there is nothing left to hear: a result nobody can be named in is not a
// result (migration `le_podium_nomme_ses_trois`, and the Réglages switch says so).

export default function Podium() {
  const theme = useTheme()
  useBarreEtatClaire()
  const { enCours: actualisation, actualiser } = useActualisation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const { sujetId } = useLocalSearchParams<{ sujetId: string }>()
  const podium = usePodium(sujetId ?? '')
  const [suiteOuverte, setSuiteOuverte] = useState(false)
  // An iPhone SE has two hundred points less than a Pro Max: the podium keeps its proportions
  // and gives up its comfort, rather than pushing the result under the fold.
  const serre = height < 760

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
  const premier = classement.find((ligne) => ligne.rang === 1) ?? null
  // A first place with no vote is only the first to have spoken: nobody carried that week.
  // A line with no name cannot carry the headline: the podium of a closed week names its three,
  // so a pseudonym here means a person who never set a first name at all.
  const gagnant = premier && premier.votes > 0 && !premier.pseudonyme ? premier : null
  const gagne = gagnant?.moi === true

  return (
    <FondSombre>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={actualisation}
            onRefresh={() => void actualiser()}
            tintColor={couleurs.blanc}
          />
        }
        style={{ backgroundColor: theme.hero }}
        contentContainerStyle={[
          styles.contenu,
          {
            paddingTop: insets.top + (serre ? espaces.s : espaces.l),
            paddingBottom: insets.bottom + espaces.m,
            gap: serre ? espaces.s : espaces.m,
          },
        ]}
      >
        <View style={styles.entete}>
          <Text style={[styles.surtitre, { color: theme.voix }]}>{t('arene.podiumSurtitre')}</Text>
          <Text style={[styles.titre, serre && styles.titreSerre]} numberOfLines={2}>
            {gagne
              ? t('arene.podiumGagne')
              : gagnant
                ? t('arene.podiumGagnant', { nom: gagnant.nom })
                : t('arene.podiumTitre')}
          </Text>
          {sujet ? (
            <Text style={[styles.sujet, { color: couleurs.encre3 }]} numberOfLines={2}>
              {`« ${sujet.texte} »`}
            </Text>
          ) : null}
        </View>

        <View style={styles.coeur}>
          {classement.length === 0 ? (
            <View style={[styles.carte, { borderColor: theme.heroBordure }]}>
              <Text style={[typographie.corps, styles.centre, { color: couleurs.encre3 }]}>
                {t('arene.podiumVide')}
              </Text>
            </View>
          ) : (
            <View>
              <View style={styles.podium}>
                {marches(classement).map((marche) => (
                  <MarchePodium key={marche.rang} marche={marche} serre={serre} />
                ))}
              </View>
              <View style={[styles.sol, { backgroundColor: theme.voix }]} />
            </View>
          )}

          {mienne && mienne.rang > 3 ? (
            <View style={[styles.carte, styles.ligneCarte, { borderColor: couleurs.or }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.surtitre, { color: theme.voix }]}>
                  {t('arene.podiumTaPlace')}
                </Text>
                <Text style={styles.maPlace}>
                  {t('arene.podiumRang', { rang: mienne.rang, total: classement.length })}
                </Text>
                {mienne.votes === 0 ? (
                  <Text style={[typographie.petit, { color: couleurs.encre3 }]}>
                    {t('arene.podiumPasDeVoix')}
                  </Text>
                ) : null}
              </View>
              {mienne.votes > 0 ? (
                <View style={styles.mesGains}>
                  <Text style={[styles.mesVotes, { color: couleurs.or }]}>
                    {mienne.votes === 1
                      ? t('arene.podiumVotesUn')
                      : t('arene.podiumVotes', { votes: mienne.votes })}
                  </Text>
                  {mienne.points > 0 ? (
                    <Text style={[styles.gainTexte, { color: couleurs.encre3 }]}>
                      {t('arene.podiumPoints', { points: mienne.points })}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : !mienne && classement.length > 0 ? (
            <View style={[styles.carte, { borderColor: theme.heroBordure }]}>
              <Text style={[typographie.corpsFort, { color: couleurs.blanc }]}>
                {t('arene.podiumPasParle')}
              </Text>
              <Text style={[typographie.petit, { color: couleurs.encre3 }]}>
                {t('arene.podiumPasParleCorps')}
              </Text>
            </View>
          ) : null}

          {suite.length > 0 ? (
            <View style={styles.suite}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setSuiteOuverte((ouverte) => !ouverte)}
                style={({ pressed }) => [styles.lienSuite, pressed && { opacity: 0.8 }]}
              >
                <Text style={[styles.lienSuiteTexte, { color: theme.voix }]}>
                  {suiteOuverte ? t('arene.podiumMasquerSuite') : t('arene.podiumSuite')}
                </Text>
                <Icone
                  sf={suiteOuverte ? 'chevron.up' : 'chevron.down'}
                  material={suiteOuverte ? 'expand-less' : 'expand-more'}
                  taille={14}
                  couleur={theme.voix}
                />
              </Pressable>
              {suiteOuverte ? (
                <View style={[styles.carte, styles.liste, { borderColor: theme.heroBordure }]}>
                  {suite.map((ligne, index) => (
                    <LigneSuite key={ligne.prise_id} ligne={ligne} premiere={index === 0} />
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* The promise about the voice is made once, before recording (C1) and in Réglages;
            saying it again after the week is over is noise on a result. */}
        <View style={styles.pied}>
          <Bouton
            libelle={t('commun.retour')}
            variante="secondaire"
            onPress={() => router.back()}
          />
        </View>
      </ScrollView>
    </FondSombre>
  )
}

/**
 * One step: the person under their medal, their votes, and a pedestal whose height says the
 * place. An empty step stays empty rather than moving someone up.
 */
function MarchePodium({ marche, serre }: { marche: Marche; serre: boolean }) {
  const theme = useTheme()
  const place = marche.rang as Place
  const metal = METAUX[place]
  const ligne = marche.ligne
  const premier = marche.rang === 1
  const taille = premier ? (serre ? 54 : 62) : serre ? 42 : 48
  const base = serre ? 78 : 104
  return (
    <View style={styles.marche}>
      {ligne ? (
        <>
          <View style={{ width: taille, height: taille }}>
            {/* The winner wears the crown; the other two wear their metal. One mark per step. */}
            {premier ? (
              <View style={styles.couronne} pointerEvents="none">
                <Couronne taille={serre ? 30 : 36} />
              </View>
            ) : null}
            <View style={[styles.cadreAvatar, { borderColor: metal.clair, borderRadius: taille }]}>
              <Avatar
                prenom={ligne.pseudonyme ? null : ligne.nom}
                uri={urlAvatar(ligne.avatar)}
                taille={taille - 10}
              />
            </View>
            {premier ? null : (
              <View style={styles.medaille}>
                <Medaille place={place} taille={22} />
              </View>
            )}
          </View>
          <Text
            style={[styles.nomMarche, premier && styles.nomPremier, { color: couleurs.blanc }]}
            numberOfLines={1}
          >
            {ligne.moi ? t('arene.ligneToi', { nom: ligne.nom }) : ligne.nom}
          </Text>
          <Text style={[styles.votesMarche, { color: metal.clair }]} numberOfLines={1}>
            {ligne.votes === 1 ? t('arene.voteUn') : t('arene.votes', { votes: ligne.votes })}
          </Text>
          {ligne.points > 0 ? (
            <View style={styles.gain}>
              <Text style={[styles.gainTexte, { color: couleurs.or }]}>
                {t('arene.podiumPoints', { points: ligne.points })}
              </Text>
            </View>
          ) : null}
        </>
      ) : (
        <Text style={[styles.votesMarche, { color: theme.heroTexteSecondaire }]}>·</Text>
      )}
      <View
        style={[
          styles.socle,
          { height: base * HAUTEURS[marche.rang] },
          premier && ligne ? styles.socleGagnant : null,
        ]}
      >
        {ligne ? (
          <Degrade de={metal.clair} a={metal.fonce} rayon={0} id={`socle${marche.rang}`} />
        ) : (
          <View style={[styles.socleVide, { borderColor: theme.heroBordure }]} />
        )}
      </View>
    </View>
  )
}

/** A line below the podium: its place, who it is, its votes. */
function LigneSuite({ ligne, premiere }: { ligne: LigneClassement; premiere: boolean }) {
  const theme = useTheme()
  return (
    <View
      style={[
        styles.ligneSuite,
        !premiere && {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.heroBordure,
        },
      ]}
    >
      <Text style={[styles.rangSuite, { color: couleurs.encre2 }]}>{ligne.rang}</Text>
      <Avatar
        prenom={ligne.pseudonyme ? null : ligne.nom}
        uri={urlAvatar(ligne.avatar)}
        taille={26}
      />
      <Text style={[styles.nomSuite, { color: couleurs.blanc }]} numberOfLines={1}>
        {ligne.moi ? t('arene.ligneToi', { nom: ligne.nom }) : ligne.nom}
      </Text>
      <Text style={[typographie.petit, { color: couleurs.encre3 }]}>
        {ligne.votes === 1 ? t('arene.voteUn') : t('arene.votes', { votes: ligne.votes })}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  contenu: { flexGrow: 1, paddingHorizontal: espaces.xl },
  entete: { alignItems: 'center', gap: espaces.xxs },
  surtitre: {
    fontFamily: polices.extraBold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  titre: {
    fontFamily: polices.extraBold,
    fontSize: 30,
    lineHeight: 35,
    letterSpacing: -0.7,
    textAlign: 'center',
    color: couleurs.blanc,
  },
  titreSerre: { fontSize: 25, lineHeight: 29 },
  sujet: { fontFamily: polices.medium, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  centre: { textAlign: 'center' },
  carte: {
    borderWidth: 1.5,
    borderRadius: rayons.xl,
    paddingVertical: espaces.s,
    paddingHorizontal: espaces.m,
    gap: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  ligneCarte: { flexDirection: 'row', alignItems: 'center', gap: espaces.s },
  maPlace: { fontFamily: polices.extraBold, fontSize: 20, lineHeight: 25, color: couleurs.blanc },
  mesVotes: { fontFamily: polices.extraBold, fontSize: 15, lineHeight: 20 },
  mesGains: { alignItems: 'flex-end', gap: 2 },
  coeur: { flex: 1, justifyContent: 'center', gap: espaces.m },
  podium: { flexDirection: 'row', alignItems: 'flex-end', gap: espaces.xs, paddingTop: 26 },
  sol: { height: 3, borderRadius: 2, opacity: 0.85 },
  marche: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  // The metal reads against the avatar's own gold only with a dark gap between the two.
  cadreAvatar: {
    borderWidth: 3,
    overflow: 'hidden',
    backgroundColor: couleurs.bleuNuit,
    padding: 2,
  },
  medaille: { position: 'absolute', right: -6, bottom: -4 },
  couronne: { position: 'absolute', alignSelf: 'center', top: -26 },
  gain: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: rayons.pilule,
    backgroundColor: 'rgba(255, 189, 89, 0.18)',
  },
  gainTexte: { fontFamily: polices.extraBold, fontSize: 11, lineHeight: 15 },
  nomMarche: { fontFamily: polices.bold, fontSize: 13, lineHeight: 17, maxWidth: '100%' },
  nomPremier: { fontFamily: polices.extraBold, fontSize: 15, lineHeight: 19 },
  votesMarche: { fontFamily: polices.bold, fontSize: 11.5, lineHeight: 15 },
  socle: {
    width: '100%',
    borderTopLeftRadius: rayons.s,
    borderTopRightRadius: rayons.s,
    overflow: 'hidden',
    marginTop: 2,
  },
  // The winner's step carries the app's own gold glow, the way its hero cards do.
  socleGagnant: {
    shadowColor: couleurs.or,
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  socleVide: {
    flex: 1,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderBottomWidth: 0,
    borderTopLeftRadius: rayons.s,
    borderTopRightRadius: rayons.s,
  },
  suite: { gap: espaces.xs },
  lienSuite: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  lienSuiteTexte: {
    fontFamily: polices.extraBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.5,
  },
  liste: { paddingVertical: 0, gap: 0 },
  ligneSuite: { flexDirection: 'row', alignItems: 'center', gap: espaces.s, paddingVertical: 9 },
  rangSuite: { fontFamily: polices.extraBold, fontSize: 13, lineHeight: 17, width: 20 },
  nomSuite: { fontFamily: polices.bold, fontSize: 14, lineHeight: 18, flex: 1 },
  pied: { paddingTop: espaces.s, gap: espaces.s },
})
