import type { DuelVue, LigneClassement } from '@leq/domaine'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'

import { Avatar } from '@/components/Avatar'
import { PorteCompte } from '@/components/PorteCompte'
import { useEspaceBarreOnglets } from '@/components/BarreOnglets'
import { CartePlaceholder } from '@/components/CartePlaceholder'
import { EnteteEcran } from '@/components/EnteteEcran'
import { Bouton } from '@/components/ui/Bouton'
import { Carte } from '@/components/ui/Carte'
import { Degrade } from '@/components/ui/Degrade'
import { Icone } from '@/components/ui/Icone'
import { Titre } from '@/components/ui/Titre'
import { t } from '@/i18n/fr'
import {
  invaliderArene,
  jourDuSujet,
  messageRefus,
  retirerMaPrise,
  useClassement,
  useDernierSujetClos,
  useMaPrise,
  useMesDuels,
  useSujet,
} from '@/services/arene'
import { useActualisation } from '@/services/actualisation'
import { useEstAnonyme, versCompte } from '@/services/compte'
import { useQuotaDebats } from '@/services/debat'
import { useConfiguration, useDrapeaux } from '@/services/configuration'
import { dureeCourte } from '@/services/delai'
import { ligneEtat, titreLigne } from '@/services/duelVue'
import { minutesDe } from '@/services/rythme'
import { lecteur, urlSignee } from '@/services/lecture'
import { urlAvatar } from '@/services/photo'
import { useTheme } from '@/theme/ThemeProvider'
import { couleurs, espaces, polices, rayons, typographie } from '@/theme/tokens'

// C1 to C4 · L'Arène. Three toggles at the top: the subject of the moment, the duels, the
// face-à-face. The subject runs seven days: you speak, then you hear the others and you vote.
// The others stay veiled until you have spoken yourself. The duels are private and their
// verdict comes from the analysis.

type Onglet = 'sujet' | 'duels' | 'face'

export default function Arene() {
  const theme = useTheme()
  const { enCours: actualisation, actualiser } = useActualisation()
  const espaceBarre = useEspaceBarreOnglets()
  const drapeaux = useDrapeaux()
  const duelsActifs = drapeaux.data?.duels === true
  const faceActif = drapeaux.data?.face_a_face === true
  const onglets: Onglet[] = [
    'sujet',
    ...(duelsActifs ? (['duels'] as const) : []),
    ...(faceActif ? (['face'] as const) : []),
  ]
  const [onglet, setOnglet] = useState<Onglet>('sujet')
  const classement = useClassement()
  const duels = useMesDuels(duelsActifs)
  const orateurs = classement.data?.classement.length ?? 0
  const duelsEnCours = (duels.data ?? []).filter((d) => d.statut === 'ouvert').length
  const pastille =
    onglet === 'sujet' && orateurs > 0
      ? orateurs === 1
        ? t('arene.orateurUn')
        : t('arene.orateurs', { nombre: orateurs })
      : onglet === 'duels' && duelsEnCours > 0
        ? duelsEnCours === 1
          ? t('duel.enCoursUn')
          : t('duel.enCours', { n: duelsEnCours })
        : null

  return (
    <ScrollView
      refreshControl={
        <RefreshControl
          refreshing={actualisation}
          onRefresh={() => void actualiser()}
          tintColor={theme.lien}
        />
      }
      style={{ backgroundColor: theme.fond }}
      contentContainerStyle={[styles.contenu, { paddingBottom: espaceBarre }]}
    >
      <EnteteEcran
        titre={t('arene.titre')}
        droite={
          pastille ? (
            <View style={[styles.pastille, { backgroundColor: theme.accentDoux }]}>
              <View style={[styles.point, { backgroundColor: couleurs.orange }]} />
              <Text style={[styles.pastilleTexte, { color: couleurs.rouge }]}>{pastille}</Text>
            </View>
          ) : undefined
        }
      />
      <View style={styles.sections}>
        {onglets.length > 1 ? (
          <View
            style={[
              styles.bascule,
              { backgroundColor: theme.carte },
              !theme.sombre && styles.basculeOmbre,
            ]}
          >
            {onglets.map((cle) => {
              const actif = onglet === cle
              return (
                <Pressable
                  key={cle}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: actif }}
                  onPress={() => setOnglet(cle)}
                  style={[
                    styles.onglet,
                    actif && {
                      backgroundColor: theme.sombre ? theme.carteDouce : couleurs.bleuNuit,
                    },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.libelleOnglet,
                      { color: actif ? couleurs.blanc : theme.texteSecondaire },
                    ]}
                  >
                    {cle === 'sujet'
                      ? t('arene.ongletSujet')
                      : cle === 'duels'
                        ? t('arene.ongletDuels')
                        : t('arene.ongletFace')}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        ) : null}
        {onglet === 'sujet' ? <Sujet /> : onglet === 'duels' ? <Duels /> : <PorteFaceAFace />}
      </View>
    </ScrollView>
  )
}

type Ecoute = { prise: string; etat: 'chargement' | 'lecture' } | null

/** C1, C2, C3: the subject, then what you can do with it depending on whether you have spoken. */
function Sujet() {
  const theme = useTheme()
  const router = useRouter()
  const clientRequetes = useQueryClient()
  const configuration = useConfiguration()
  const sujet = useSujet()
  const maPrise = useMaPrise(sujet.data?.id ?? null)
  const anonyme = useEstAnonyme()
  const classement = useClassement()
  // One player for the whole tab: a tap plays or stops, and a take still decoding takes no
  // second tap. The same control sits on the hero and on every line the person may hear.
  const [ecoute, setEcoute] = useState<Ecoute>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [retrait, setRetrait] = useState(false)
  useEffect(() => () => lecteur.arreter(), [])
  const ecouter = async (priseId: string, chemin: string) => {
    if (ecoute?.prise === priseId) {
      if (ecoute.etat === 'chargement') return
      lecteur.arreter()
      setEcoute(null)
      return
    }
    setMessage(null)
    setEcoute({ prise: priseId, etat: 'chargement' })
    try {
      await lecteur.jouer(await urlSignee(chemin), () => setEcoute(null))
      setEcoute({ prise: priseId, etat: 'lecture' })
    } catch (erreur) {
      console.warn('arène: lecture impossible', erreur)
      setEcoute(null)
      setMessage(t('arene.lectureEchouee'))
    }
  }
  const retirer = (priseId: string) => {
    Alert.alert(t('arene.retirerTitre'), t('arene.retirerCorps'), [
      { text: t('arene.retirerGarder'), style: 'cancel' },
      {
        text: t('arene.retirerConfirmer'),
        style: 'destructive',
        onPress: () => {
          setRetrait(true)
          lecteur.arreter()
          setEcoute(null)
          void retirerMaPrise(priseId)
            .then(() => invaliderArene(clientRequetes))
            .catch((erreur: unknown) => setMessage(messageRefus(erreur)))
            .finally(() => setRetrait(false))
        },
      },
    ])
  }
  const jours = configuration.data?.duree_sujet_arene_jours ?? 7
  const points = configuration.data?.points_par_vote ?? 5

  if (sujet.isPending) {
    return (
      <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
        {t('commun.chargement')}
      </Text>
    )
  }
  if (!sujet.data) {
    return (
      <Carte teinte="douce" style={styles.bloc}>
        <Text style={[typographie.titreCarte, { color: theme.texte }]}>
          {t('arene.aucunSujetTitre')}
        </Text>
        <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
          {t('arene.aucunSujetCorps')}
        </Text>
      </Carte>
    )
  }

  const prise = maPrise.data ?? null
  const parle = prise !== null
  const lignes = classement.data?.classement ?? []
  const mienne = lignes.find((ligne) => ligne.moi) ?? null
  const autres = lignes.filter((ligne) => !ligne.moi).length
  const audible = Boolean(prise?.chemin_audio) && !prise?.audio_supprime_le
  // A place is a place once a vote exists; before that the first line is only the first person
  // who spoke, and a crown on it would be a ranking nobody made.
  const votes = lignes.some((ligne) => ligne.votes > 0)
  const votesOuverts = parle && prise.statut === 'publiee' && autres >= 2
  const dureeMienne = dureeCourte(mienne?.duree_s)

  return (
    <>
      <View style={styles.heroOmbre}>
        <View style={styles.hero}>
          <Degrade de={couleurs.bleu} a={couleurs.bleuNuit} rayon={26} id="arene" />
          <View style={styles.ligne}>
            <Text style={[styles.heroEtiquette, { flex: 1 }]}>
              {votesOuverts ? t('arene.votesOuverts') : t('arene.sujetSemaine')}
            </Text>
            <Text style={styles.heroEtiquette}>
              {t('arene.jour', { jour: jourDuSujet(sujet.data, jours), total: jours })}
            </Text>
          </View>
          <Text style={styles.heroTitre}>{sujet.data.texte}</Text>
          {sujet.data.consigne && !parle ? (
            <Text style={[styles.heroCorps, { color: couleurs.encre3 }]}>
              {sujet.data.consigne}
            </Text>
          ) : null}
          {!parle ? (
            <>
              <Bouton
                variante="or"
                libelle={t('arene.enregistrer', { minutes: minutesDe(sujet.data.duree_max_s) })}
                onPress={() => router.push(anonyme ? versCompte('arene') : '/arene/prise')}
              />
              {anonyme ? (
                <PorteCompte raison="arene" surFondSombre />
              ) : (
                <Text style={styles.heroNote}>{t('arene.conservation')}</Text>
              )}
            </>
          ) : (
            <>
              <View style={styles.heroEtat}>
                <View style={styles.ligne}>
                  {prise.statut === 'publiee' ? (
                    <View style={styles.coche}>
                      <Icone
                        sf="checkmark"
                        material="check"
                        taille={12}
                        couleur={couleurs.bleuNuit}
                      />
                    </View>
                  ) : null}
                  <Text style={[styles.libelleEtat, { color: couleurs.or, flex: 1 }]}>
                    {prise.statut === 'publiee'
                      ? t('arene.passageDedans')
                      : prise.statut === 'retiree'
                        ? t('arene.passageRetire')
                        : t('arene.signalee')}
                  </Text>
                  {dureeMienne ? <Text style={styles.heroDuree}>{dureeMienne}</Text> : null}
                </View>
                {prise.statut !== 'publiee' ? (
                  <Text style={[styles.heroCorps, { color: couleurs.encre3 }]}>
                    {prise.statut === 'retiree'
                      ? t('arene.passageRetireDetail')
                      : t('arene.signaleeDetail')}
                  </Text>
                ) : null}
              </View>
              {prise.statut !== 'retiree' ? (
                <View style={styles.rangee}>
                  {audible ? (
                    <Bouton
                      variante="secondaire"
                      surFondSombre
                      style={{ flex: 1 }}
                      libelle={
                        ecoute?.prise === prise.id
                          ? ecoute.etat === 'chargement'
                            ? t('commun.chargement')
                            : t('arene.arreter')
                          : t('arene.reecouter')
                      }
                      onPress={() => void ecouter(prise.id, prise.chemin_audio!)}
                    />
                  ) : null}
                  <Bouton
                    variante="secondaire"
                    surFondSombre
                    style={{ flex: 1 }}
                    libelle={t('arene.retirer')}
                    chargement={retrait}
                    onPress={() => retirer(prise.id)}
                  />
                </View>
              ) : null}
              {prise.statut === 'publiee' ? (
                votesOuverts ? (
                  <Bouton
                    variante="or"
                    libelle={t('arene.ecouterEtVoter', { points })}
                    onPress={() => router.push('/arene/voter')}
                  />
                ) : (
                  <Text style={styles.heroNote}>
                    {autres === 0 ? t('arene.seulPassage') : t('arene.encoreUnPassage')}
                  </Text>
                )
              ) : null}
            </>
          )}
        </View>
      </View>

      {message ? (
        <Text style={[typographie.petit, { color: theme.texteSecondaire, textAlign: 'center' }]}>
          {message}
        </Text>
      ) : null}

      {lignes.length > 0 ? (
        <View style={styles.section}>
          {/* Nobody has been voted for yet: the order is the order of arrival, so the list is
              what it is, the passages of the week. Crowns and places come with the votes. */}
          <Titre niveau="section">
            {votes ? t('arene.classement') : t('arene.passagesSemaine')}
          </Titre>
          <Carte style={styles.liste}>
            {lignes.map((ligne, index) => (
              <LigneClassementVue
                key={ligne.prise_id}
                ligne={ligne}
                premiere={index === 0}
                classe={votes}
                ecoute={ecoute}
                onEcouter={
                  ligne.chemin_audio
                    ? () => void ecouter(ligne.prise_id, ligne.chemin_audio!)
                    : null
                }
              />
            ))}
          </Carte>
        </View>
      ) : null}

      <PodiumPasse />
    </>
  )
}

/** One line of the ranking: the rank, the person, the votes, and the passage to hear. */
function LigneClassementVue({
  ligne,
  premiere,
  classe,
  ecoute,
  onEcouter,
}: {
  ligne: LigneClassement
  premiere: boolean
  /** True once a vote exists: the line then carries its place and its count. */
  classe: boolean
  ecoute: Ecoute
  onEcouter: (() => void) | null
}) {
  const theme = useTheme()
  const enLecture = ecoute?.prise === ligne.prise_id
  const duree = dureeCourte(ligne.duree_s)
  const detail = [
    classe
      ? ligne.votes === 1
        ? t('arene.voteUn')
        : t('arene.votes', { votes: ligne.votes })
      : null,
    duree,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <View
      style={[
        styles.ligne,
        styles.lignePadding,
        !premiere && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.bordure },
      ]}
    >
      {classe ? <Rang rang={ligne.rang} /> : null}
      <Avatar
        prenom={ligne.pseudonyme ? null : ligne.nom}
        uri={urlAvatar(ligne.avatar)}
        taille={36}
      />
      <View style={styles.ligneTexte}>
        <Text style={[styles.nomLigne, { color: theme.texte }]} numberOfLines={1}>
          {ligne.moi ? t('arene.ligneToi', { nom: ligne.nom }) : ligne.nom}
        </Text>
        <Text style={[typographie.petit, { color: theme.texteSecondaire }]}>{detail}</Text>
      </View>
      {onEcouter ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            enLecture
              ? t('arene.arreter')
              : ligne.moi
                ? t('arene.ecouterMonPassage')
                : t('arene.ecouterPassage')
          }
          accessibilityState={{ busy: enLecture && ecoute?.etat === 'chargement' }}
          onPress={onEcouter}
          hitSlop={8}
          style={({ pressed }) => [
            styles.lecture,
            { backgroundColor: enLecture ? theme.texte : theme.lien },
            pressed && { opacity: 0.85 },
            enLecture && ecoute?.etat === 'chargement' && { opacity: 0.6 },
          ]}
        >
          <Icone
            sf={enLecture && ecoute?.etat === 'lecture' ? 'stop.fill' : 'play.fill'}
            material={enLecture && ecoute?.etat === 'lecture' ? 'stop' : 'play-arrow'}
            taille={enLecture ? 14 : 16}
            couleur={couleurs.blanc}
          />
        </Pressable>
      ) : null}
    </View>
  )
}

/**
 * The rank. The first three wear a crown, gold, silver and bronze, with their number beside it,
 * the way a podium is read at a glance; from the fourth on, the number alone.
 */
const COURONNES: Readonly<Record<number, { fond: string; encre: string }>> = {
  1: { fond: couleurs.or, encre: couleurs.bleuNuit },
  2: { fond: '#C9D1DC', encre: couleurs.bleuNuit },
  3: { fond: '#D9A074', encre: couleurs.bleuNuit },
}

function Rang({ rang }: { rang: number }) {
  const theme = useTheme()
  const couronne = COURONNES[rang]
  return (
    <View style={styles.rangBloc} accessibilityLabel={t('arene.rang', { rang })}>
      {couronne ? (
        <View style={[styles.couronne, { backgroundColor: couronne.fond }]}>
          <Icone sf="crown.fill" material="emoji-events" taille={13} couleur={couronne.encre} />
        </View>
      ) : null}
      <Text style={[styles.rangTexte, { color: couronne ? theme.texte : theme.texteTertiaire }]}>
        {rang}
      </Text>
    </View>
  )
}

/** C8 entry: the week that just closed, one tap away, as long as one has closed. */
function PodiumPasse() {
  const theme = useTheme()
  const router = useRouter()
  const dernier = useDernierSujetClos()
  const sujet = dernier.data
  if (!sujet) return null
  return (
    <Carte teinte="sombre" style={styles.bloc}>
      <Text style={[typographie.etiquette, styles.majuscules, { color: theme.voix }]}>
        {t('arene.podiumSurtitre')}
      </Text>
      <Text style={[typographie.corps, { color: theme.heroTexteSecondaire }]}>{sujet.texte}</Text>
      <Bouton
        libelle={t('arene.podiumEntree')}
        variante="secondaire"
        onPress={() => router.push(`/arene/podium/${sujet.id}`)}
      />
    </Carte>
  )
}

/** The door to the face-à-face, where people actually look for it. E0's own screen prepares it. */
function PorteFaceAFace() {
  const theme = useTheme()
  const router = useRouter()
  const anonyme = useEstAnonyme()
  const quota = useQuotaDebats()
  const restantes = quota.data?.restants ?? null

  return (
    <>
      <Carte teinte="douce" style={styles.porte}>
        <Titre niveau="section">{t('debat.porte')}</Titre>
        <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
          {t('debat.porteDetail')}
        </Text>
        {restantes !== null ? (
          <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>
            {restantes === 0
              ? t('debat.aucuneSession')
              : restantes === 1
                ? t('debat.sessionRestante')
                : t('debat.sessionsRestantes', { restantes: String(restantes) })}
          </Text>
        ) : null}
      </Carte>
      <Bouton
        libelle={t('debat.commencer')}
        onPress={() => router.push(anonyme ? versCompte('debat') : '/face-a-face')}
        desactive={!anonyme && restantes === 0}
      />
      {anonyme ? <PorteCompte raison="debat" /> : null}
    </>
  )
}

/** C4: the duels in progress and the finished ones, each with the person on the other side. */
function Duels() {
  const theme = useTheme()
  const anonyme = useEstAnonyme()
  const router = useRouter()
  const duels = useMesDuels()

  if (duels.isPending) {
    return (
      <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
        {t('commun.chargement')}
      </Text>
    )
  }
  const liste = duels.data ?? []
  const enCours = liste.filter((d) => d.statut === 'ouvert')
  const passes = liste.filter((d) => d.statut !== 'ouvert')

  return (
    <>
      <Bouton
        libelle={t('duel.defier')}
        onPress={() => router.push(anonyme ? versCompte('duel') : '/duel/nouveau')}
      />
      {anonyme ? <PorteCompte raison="duel" /> : null}
      {liste.length === 0 ? (
        <CartePlaceholder phrase={t('duel.aucun')} />
      ) : (
        <>
          {enCours.length > 0 ? (
            <ListeDuels titre={t('duel.enCoursSection')} duels={enCours} />
          ) : null}
          {passes.length > 0 ? <ListeDuels titre={t('duel.passesSection')} duels={passes} /> : null}
        </>
      )}
      <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>
        {t('duel.automatique')}
      </Text>
    </>
  )
}

function ListeDuels({ titre, duels }: { titre: string; duels: DuelVue[] }) {
  const theme = useTheme()
  return (
    <Carte style={styles.liste}>
      <Text style={[styles.etiquetteListe, { color: theme.texteTertiaire }]}>{titre}</Text>
      {duels.map((duel, index) => (
        <LigneDuel key={duel.id} duel={duel} premiere={index === 0} />
      ))}
    </Carte>
  )
}

function LigneDuel({ duel, premiere }: { duel: DuelVue; premiere: boolean }) {
  const theme = useTheme()
  const router = useRouter()
  const aToi = duel.statut === 'ouvert' && duel.adversaire !== null && !duel.moi.a_parle
  const termine = duel.statut !== 'ouvert'
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/duel/${duel.id}`)}
      style={({ pressed }) => [pressed && { opacity: 0.8 }]}
    >
      <View
        style={[
          styles.ligne,
          styles.ligneDuel,
          !premiere && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.bordure },
        ]}
      >
        {duel.adversaire ? (
          <Avatar
            prenom={duel.adversaire.prenom}
            uri={urlAvatar(duel.adversaire.avatar)}
            taille={40}
          />
        ) : (
          <View style={[styles.siegeVide, { backgroundColor: theme.carteDouce }]}>
            <Icone
              sf="person.badge.plus"
              material="person-add"
              taille={18}
              couleur={theme.texteTertiaire}
            />
          </View>
        )}
        <View style={styles.ligneTexte}>
          <Text style={[styles.nomLigne, { color: theme.texte }]} numberOfLines={1}>
            {titreLigne(duel)}
          </Text>
          <Text style={[typographie.petit, { color: theme.texteSecondaire }]} numberOfLines={2}>
            {duel.sujet}
          </Text>
          <Text
            style={[
              styles.etatDuel,
              { color: aToi || (termine && duel.verdict) ? couleurs.rouge : theme.texteTertiaire },
            ]}
            numberOfLines={1}
          >
            {ligneEtat(duel)}
          </Text>
        </View>
        <View
          style={[
            styles.piluleVoir,
            { backgroundColor: aToi ? theme.accentDoux : theme.carteDouce },
          ]}
        >
          <Text
            style={[
              styles.piluleVoirTexte,
              { color: aToi ? couleurs.rouge : theme.texteSecondaire },
            ]}
          >
            {t('duel.voir')}
          </Text>
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  contenu: {},
  sections: { paddingHorizontal: espaces.xl, gap: espaces.m },
  section: { gap: espaces.s },
  bloc: { gap: espaces.s },
  liste: { paddingVertical: 0 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espaces.s },
  lignePadding: { paddingVertical: espaces.m },
  ligneDuel: { paddingVertical: espaces.m },
  rangee: { flexDirection: 'row', gap: espaces.s },
  rangBloc: { width: 48, flexDirection: 'row', alignItems: 'center', gap: 4 },
  couronne: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangTexte: { fontFamily: polices.extraBold, fontSize: 14, lineHeight: 18 },
  ligneTexte: { flex: 1, gap: 1 },
  nomLigne: { fontFamily: polices.bold, fontSize: 15, lineHeight: 20 },
  lecture: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  majuscules: { textTransform: 'uppercase', letterSpacing: 1 },
  pastille: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: rayons.pilule,
    marginBottom: 6,
  },
  point: { width: 7, height: 7, borderRadius: 4 },
  pastilleTexte: {
    fontFamily: polices.extraBold,
    fontSize: 11.5,
    lineHeight: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  bascule: { flexDirection: 'row', padding: 5, borderRadius: rayons.pilule },
  basculeOmbre: {
    shadowColor: couleurs.bleuNuit,
    shadowOpacity: 0.07,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  onglet: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: espaces.xs,
    borderRadius: rayons.pilule,
  },
  libelleOnglet: {
    textAlign: 'center',
    fontFamily: polices.extraBold,
    fontSize: 13.5,
    lineHeight: 18,
  },
  // The subject's hero card, as the mockup paints it: a gradient, the gesture inside it.
  heroOmbre: {
    borderRadius: 26,
    shadowColor: couleurs.bleu,
    shadowOpacity: 0.3,
    shadowRadius: 17,
    shadowOffset: { width: 0, height: 16 },
    elevation: 8,
  },
  hero: { gap: 14, padding: espaces.xl, borderRadius: 26, overflow: 'hidden' },
  heroEtiquette: {
    fontFamily: polices.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: couleurs.or,
  },
  heroTitre: {
    fontFamily: polices.extraBold,
    fontSize: 25,
    lineHeight: 28.5,
    letterSpacing: -0.65,
    color: couleurs.blanc,
  },
  heroCorps: { fontFamily: polices.medium, fontSize: 14, lineHeight: 21 },
  heroDuree: { fontFamily: polices.bold, fontSize: 13, lineHeight: 18, color: couleurs.encre3 },
  heroNote: {
    fontFamily: polices.semiBold,
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: 'center',
    color: couleurs.encre2,
  },
  heroEtat: { gap: 4 },
  coche: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: couleurs.or,
    alignItems: 'center',
    justifyContent: 'center',
  },
  libelleEtat: { fontFamily: polices.bold, fontSize: 15, lineHeight: 20 },
  porte: { gap: espaces.s },
  etiquetteListe: {
    fontFamily: polices.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingTop: espaces.m,
  },
  siegeVide: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  etatDuel: { fontFamily: polices.semiBold, fontSize: 12.5, lineHeight: 16, marginTop: 2 },
  piluleVoir: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: rayons.pilule },
  piluleVoirTexte: { fontFamily: polices.extraBold, fontSize: 12, lineHeight: 16 },
})
