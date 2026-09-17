import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { useEspaceBarreOnglets } from '@/components/BarreOnglets'
import { CartePlaceholder } from '@/components/CartePlaceholder'
import { EnteteEcran } from '@/components/EnteteEcran'
import { Bouton } from '@/components/ui/Bouton'
import { Carte } from '@/components/ui/Carte'
import { Degrade } from '@/components/ui/Degrade'
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
import { useQuotaDebats } from '@/services/debat'
import { useConfiguration, useDrapeaux } from '@/services/configuration'
import { minutesDe } from '@/services/rythme'
import { lecteur, urlSignee } from '@/services/lecture'
import { useTheme } from '@/theme/ThemeProvider'
import { couleurs, espaces, polices, rayons, typographie } from '@/theme/tokens'

// C1 to C4 · L'Arène. Two toggles at the top: the subject of the moment, and the duels. The
// subject runs seven days: you speak, you listen, you vote. The others stay veiled until you
// have spoken yourself. The duels are private and their verdict comes from the analysis.

type Onglet = 'sujet' | 'duels' | 'face'

export default function Arene() {
  const theme = useTheme()
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
  // Listening to one's own passage: the same player as the votes, on the same signed URL.
  const [ecoute, setEcoute] = useState(false)
  useEffect(() => () => lecteur.arreter(), [])
  const ecouterMonPassage = async (chemin: string) => {
    if (ecoute) return
    setEcoute(true)
    try {
      await lecteur.jouer(await urlSignee(chemin), () => setEcoute(false))
    } catch (erreur) {
      console.warn('arène: lecture impossible', erreur)
      setEcoute(false)
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
                onPress={() => router.push('/arene/prise')}
              />
              <Text style={styles.heroNote}>{t('arene.conservation')}</Text>
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
              {maPrise.data?.chemin_audio && !maPrise.data.audio_supprime_le ? (
                <Bouton
                  variante="secondaire"
                  surFondSombre
                  libelle={t('arene.ecouterMonPassage')}
                  desactive={ecoute}
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
                <Text style={[typographie.corpsFort, styles.rang, { color: theme.texteTertiaire }]}>
                  {ligne.rang}
                </Text>
                <Text style={[typographie.corpsFort, { color: theme.texte, flex: 1 }]}>
                  {ligne.moi ? t('arene.moi') : ligne.nom}
                </Text>
                <Text style={[typographie.petit, { color: theme.texteSecondaire }]}>
                  {ligne.votes === 1 ? t('arene.voteUn') : t('arene.votes', { votes: ligne.votes })}
                </Text>
              </View>
            ))}
          </Carte>
        </View>
      ) : null}

      <PodiumPasse />
    </>
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
        onPress={() => router.push('/face-a-face')}
        desactive={restantes === 0}
      />
    </>
  )
}

function Duels() {
  const theme = useTheme()
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
      <Bouton libelle={t('arene.defier')} onPress={() => router.push('/duel/nouveau')} />
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
  rang: { width: 22 },
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
