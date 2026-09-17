import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'

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
  jourDuSujet,
  useClassement,
  useDernierSujetClos,
  useDuels,
  useMaPrise,
  useSujet,
} from '@/services/arene'
import { useActualisation } from '@/services/actualisation'
import { useEstAnonyme, versCompte } from '@/services/compte'
import { useQuotaDebats } from '@/services/debat'
import { useConfiguration, useDrapeaux } from '@/services/configuration'
import { minutesDe } from '@/services/rythme'
import { lecteur, urlSignee } from '@/services/lecture'
import { urlAvatar } from '@/services/photo'
import { useTheme } from '@/theme/ThemeProvider'
import { couleurs, espaces, polices, rayons, typographie } from '@/theme/tokens'

// C1 to C4 · L'Arène. Two toggles at the top: the subject of the moment, and the duels. The
// subject runs seven days: you speak, you listen, you vote. The others stay veiled until you
// have spoken yourself. The duels are private and their verdict comes from the analysis.

type Onglet = 'sujet' | 'duels' | 'face'

export default function Arene() {
  const theme = useTheme()
  const { enCours: actualisation, actualiser } = useActualisation()
  const espaceBarre = useEspaceBarreOnglets()
  const drapeaux = useDrapeaux()
  const duelsActifs = drapeaux.data?.duels === true
  // The face-à-face used to live under « Moi · mon profil d'orateur », where nobody thinks to
  // look for a debate. It belongs here, next to the other two ways of speaking against someone.
  const faceActif = drapeaux.data?.face_a_face === true
  const onglets: Onglet[] = [
    'sujet',
    ...(duelsActifs ? (['duels'] as const) : []),
    ...(faceActif ? (['face'] as const) : []),
  ]
  const [onglet, setOnglet] = useState<Onglet>('sujet')

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
      <EnteteEcran titre={t('arene.titre')} />
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

/** C1, C2, C3: the subject, then what you can do with it depending on whether you have spoken. */
function Sujet() {
  const theme = useTheme()
  const router = useRouter()
  const configuration = useConfiguration()
  const sujet = useSujet()
  const maPrise = useMaPrise(sujet.data?.id ?? null)
  const anonyme = useEstAnonyme()
  // Listening to one's own passage: the same player as the votes, on the same signed URL. One
  // control plays and stops; while the take is decoding it says so and takes no second tap.
  const [ecoute, setEcoute] = useState<'inactif' | 'chargement' | 'lecture'>('inactif')
  useEffect(() => () => lecteur.arreter(), [])
  const ecouterMonPassage = async (chemin: string) => {
    if (ecoute === 'chargement') return
    if (ecoute === 'lecture') {
      lecteur.arreter()
      setEcoute('inactif')
      return
    }
    setEcoute('chargement')
    try {
      await lecteur.jouer(await urlSignee(chemin), () => setEcoute('inactif'))
      setEcoute('lecture')
    } catch (erreur) {
      console.warn('arène: lecture impossible', erreur)
      setEcoute('inactif')
    }
  }
  const classement = useClassement()
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

  const parle = maPrise.data !== null && maPrise.data !== undefined
  const lignes = classement.data?.classement ?? []
  const audible = Boolean(maPrise.data?.chemin_audio) && !maPrise.data?.audio_supprime_le
  const dansLeClassement = lignes.some((ligne) => ligne.moi)

  return (
    <>
      <View style={styles.heroOmbre}>
        <View style={styles.hero}>
          <Degrade de={couleurs.bleu} a={couleurs.bleuNuit} rayon={26} id="arene" />
          <View style={styles.ligne}>
            <Text style={[styles.heroEtiquette, { flex: 1 }]}>{t('arene.sujetSemaine')}</Text>
            <Text style={styles.heroEtiquette}>
              {t('arene.jour', { jour: jourDuSujet(sujet.data, jours), total: jours })}
            </Text>
          </View>
          <Text style={styles.heroTitre}>{sujet.data.texte}</Text>
          {sujet.data.consigne ? (
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
                <Text style={[styles.libelleEtat, { color: couleurs.blanc }]}>
                  {maPrise.data?.statut === 'publiee'
                    ? t('arene.passageDedans')
                    : maPrise.data?.statut === 'retiree'
                      ? t('arene.passageRetire')
                      : t('arene.signalee')}
                </Text>
                <Text style={[styles.heroCorps, { color: couleurs.encre3 }]}>
                  {maPrise.data?.statut === 'publiee'
                    ? t('arene.passageDetail')
                    : maPrise.data?.statut === 'retiree'
                      ? t('arene.passageRetireDetail')
                      : t('arene.signaleeDetail')}
                </Text>
              </View>
              {audible && !dansLeClassement ? (
                <Bouton
                  variante="secondaire"
                  surFondSombre
                  libelle={
                    ecoute === 'lecture'
                      ? t('arene.arreter')
                      : ecoute === 'chargement'
                        ? t('commun.chargement')
                        : t('arene.ecouterMonPassage')
                  }
                  onPress={() => void ecouterMonPassage(maPrise.data!.chemin_audio!)}
                />
              ) : null}
              <Bouton
                variante="or"
                libelle={t('arene.ecouterEtVoter', { points })}
                onPress={() => router.push('/arene/voter')}
              />
            </>
          )}
        </View>
      </View>

      {lignes.length > 0 ? (
        <View style={styles.section}>
          <Titre niveau="section">{t('arene.classement')}</Titre>
          <Carte style={styles.liste}>
            {lignes.map((ligne, index) => (
              <View
                key={ligne.prise_id}
                style={[
                  styles.ligne,
                  styles.lignePadding,
                  index > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: theme.bordure,
                  },
                ]}
              >
                <Rang rang={ligne.rang} />
                <Avatar
                  prenom={ligne.pseudonyme ? null : ligne.nom}
                  uri={urlAvatar(ligne.avatar)}
                  taille={36}
                />
                <View style={styles.ligneTexte}>
                  <Text style={[styles.nomLigne, { color: theme.texte }]} numberOfLines={1}>
                    {ligne.moi ? t('arene.ligneToi', { nom: ligne.nom }) : ligne.nom}
                  </Text>
                  <Text style={[typographie.petit, { color: theme.texteSecondaire }]}>
                    {ligne.votes === 1
                      ? t('arene.voteUn')
                      : t('arene.votes', { votes: ligne.votes })}
                  </Text>
                </View>
                {ligne.moi && audible ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      ecoute === 'lecture' ? t('arene.arreter') : t('arene.ecouterMonPassage')
                    }
                    accessibilityState={{ busy: ecoute === 'chargement' }}
                    onPress={() => void ecouterMonPassage(maPrise.data!.chemin_audio!)}
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.lecture,
                      { backgroundColor: ecoute === 'lecture' ? theme.texte : theme.lien },
                      pressed && { opacity: 0.85 },
                      ecoute === 'chargement' && { opacity: 0.6 },
                    ]}
                  >
                    <Icone
                      sf={ecoute === 'lecture' ? 'stop.fill' : 'play.fill'}
                      material={ecoute === 'lecture' ? 'stop' : 'play-arrow'}
                      taille={ecoute === 'lecture' ? 14 : 16}
                      couleur={couleurs.blanc}
                    />
                  </Pressable>
                ) : null}
              </View>
            ))}
          </Carte>
        </View>
      ) : null}

      <PodiumPasse />
    </>
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

/** C4: the duels in progress and the finished ones. */
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

function Duels() {
  const theme = useTheme()
  const anonyme = useEstAnonyme()
  const router = useRouter()
  const clientRequetes = useQueryClient()
  const duels = useDuels()
  void clientRequetes

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
        libelle={t('arene.defier')}
        onPress={() => router.push(anonyme ? versCompte('duel') : '/duel/nouveau')}
      />
      {anonyme ? <PorteCompte raison="duel" /> : null}
      {liste.length === 0 ? (
        <CartePlaceholder phrase={t('arene.duelsAucun')} />
      ) : (
        <>
          {enCours.length > 0 ? (
            <View style={styles.section}>
              <Titre niveau="section">{t('arene.duelsEnCours')}</Titre>
              {enCours.map((duel) => (
                <LigneDuel key={duel.id} duel={duel} />
              ))}
            </View>
          ) : null}
          {passes.length > 0 ? (
            <View style={styles.section}>
              <Titre niveau="section">{t('arene.duelsPasses')}</Titre>
              {passes.map((duel) => (
                <LigneDuel key={duel.id} duel={duel} />
              ))}
            </View>
          ) : null}
        </>
      )}
      <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>
        {t('arene.verdictAutomatique')}
      </Text>
    </>
  )
}

function LigneDuel({ duel }: { duel: import('@leq/domaine').Duel }) {
  const theme = useTheme()
  const router = useRouter()
  const etat =
    duel.statut === 'clos'
      ? t('arene.verdictPret')
      : duel.statut === 'expire'
        ? t('arene.duelExpire')
        : duel.invite_id === null
          ? t('arene.attenteReponse')
          : t('arene.aToiDeParler')
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(`/duel/${duel.id}`)}>
      <Carte style={[styles.ligne, styles.bloc]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[typographie.corpsFort, { color: theme.texte }]}>{duel.sujet}</Text>
          <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>{etat}</Text>
        </View>
        <Text style={[typographie.etiquette, { color: theme.lien }]}>{t('arene.voir')}</Text>
      </Carte>
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
  heroNote: {
    fontFamily: polices.semiBold,
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: 'center',
    color: couleurs.encre2,
  },
  heroEtat: { gap: 4 },
  libelleEtat: { fontFamily: polices.bold, fontSize: 15, lineHeight: 20 },
  porte: { gap: espaces.s },
})
