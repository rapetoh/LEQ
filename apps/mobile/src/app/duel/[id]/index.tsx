import { issueDuel, lienInvitationDuel, type CoteDuel, type DuelVue } from '@leq/domaine'
import { useQueryClient } from '@tanstack/react-query'
import * as Clipboard from 'expo-clipboard'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Avatar, AvatarsDuel } from '@/components/Avatar'
import { ControleLecture } from '@/components/ControleLecture'
import { EcranChargement, EcranErreur } from '@/components/EcransEtat'
import { Bouton } from '@/components/ui/Bouton'
import { Carte } from '@/components/ui/Carte'
import { Icone } from '@/components/ui/Icone'
import { Titre } from '@/components/ui/Titre'
import { t } from '@/i18n/fr'
import { useActualisation } from '@/services/actualisation'
import { creerDuel, invaliderArene, messageRefus, useMesDuels } from '@/services/arene'
import { dureeCourte, maintenant, texteReste } from '@/services/delai'
import { badgeDuel, nomAdversaire } from '@/services/duelVue'
import { lecteur, urlSignee } from '@/services/lecture'
import { urlAvatar } from '@/services/photo'
import { useProfil } from '@/services/profil'
import { compter } from '@/services/usage'
import { useTheme } from '@/theme/ThemeProvider'
import { couleurs, espaces, polices, rayons, typographie } from '@/theme/tokens'

// C6 · Le duel. Two seats face to face: the person and the other side, each with whether they
// have spoken and, once the duel is closed, their take to hear. Under them, what happens now:
// an invitation to send, a take to record, a wait, or the verdict. The duel is private and the
// verdict is rendered by the analysis on Rebecca's grid; while her grid is not in place the
// screen says so and puts the two takes' measures side by side.

// Where the public pages live. Phase 9 points EXPO_PUBLIC_LIEN_DUEL at the real domain.
const BASE_LIEN = process.env.EXPO_PUBLIC_LIEN_DUEL ?? 'https://leq-serveur.fly.dev'

type Ecoute = { prise: string; etat: 'chargement' | 'lecture'; depuis?: number } | null

export default function EcranDuel() {
  const params = useLocalSearchParams<{ id?: string }>()
  const id = typeof params.id === 'string' ? params.id : null
  const theme = useTheme()
  const { enCours: actualisation, actualiser } = useActualisation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const clientRequetes = useQueryClient()
  const duels = useMesDuels()
  const profil = useProfil()
  const [ecoute, setEcoute] = useState<Ecoute>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [revanche, setRevanche] = useState(false)

  useEffect(() => () => lecteur.arreter(), [])

  if (duels.isPending) return <EcranChargement />
  const duel = duels.data?.find((d) => d.id === id)
  if (duels.isError || !duel) {
    return <EcranErreur message={t('arene.refusInconnu')} reessayer={() => void duels.refetch()} />
  }

  const nom = nomAdversaire(duel)
  const issue = issueDuel(duel)
  const lien = duel.jeton ? lienInvitationDuel(BASE_LIEN, duel.jeton) : null

  const ecouter = async (cote: CoteDuel) => {
    if (!cote.prise_id || !cote.chemin_audio) return
    if (ecoute?.prise === cote.prise_id) {
      if (ecoute.etat === 'chargement') return
      lecteur.arreter()
      setEcoute(null)
      return
    }
    setEcoute({ prise: cote.prise_id, etat: 'chargement' })
    try {
      await lecteur.jouer(await urlSignee(cote.chemin_audio), () => setEcoute(null))
      setEcoute({ prise: cote.prise_id, etat: 'lecture', depuis: maintenant() })
    } catch (erreur) {
      console.warn('duel: lecture impossible', erreur)
      setEcoute(null)
      setMessage(t('arene.lectureEchouee'))
    }
  }

  const partager = async () => {
    if (!lien) return
    try {
      await Share.share({ message: t('duel.messageInvitation', { sujet: duel.sujet, lien }) })
    } catch (erreur) {
      console.warn('duel: partage impossible', erreur)
    }
  }

  const copier = async () => {
    if (!lien) return
    await Clipboard.setStringAsync(lien)
    setMessage(t('duel.lienCopie'))
  }

  const relancer = async () => {
    setRevanche(true)
    try {
      const nouveau = await creerDuel(duel.sujet)
      compter('duel_cree')
      invaliderArene(clientRequetes)
      router.replace(`/duel/${nouveau.id}`)
    } catch (erreur) {
      setMessage(messageRefus(erreur))
      setRevanche(false)
    }
  }

  const badge = badgeDuel(duel)

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
      contentContainerStyle={[
        styles.contenu,
        { paddingTop: insets.top + espaces.xl, paddingBottom: insets.bottom + espaces.xl },
      ]}
    >
      <View style={styles.entete}>
        <AvatarsDuel
          moi={{ prenom: profil.data?.prenom ?? null, uri: urlAvatar(profil.data?.avatar_chemin) }}
          lui={
            duel.adversaire
              ? { prenom: duel.adversaire.prenom, uri: urlAvatar(duel.adversaire.avatar) }
              : null
          }
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.surtitre, { color: theme.texte }]} numberOfLines={1}>
            {duel.adversaire ? (
              <>
                <Text style={{ color: couleurs.orange }}>{t('duel.vsSigle')}</Text>
                {` ${nom}`}
              </>
            ) : (
              t('duel.sansAdversaire')
            )}
          </Text>
          {badge ? <Badge badge={badge} /> : null}
        </View>
      </View>
      <Titre niveau="ecran">{duel.sujet}</Titre>

      <View style={styles.sieges}>
        <Siege
          moi
          nom={t('duel.toi')}
          prenom={profil.data?.prenom ?? null}
          avatar={urlAvatar(profil.data?.avatar_chemin)}
          cote={duel.moi}
          vainqueur={issue === 'gagne'}
          ecoute={ecoute}
          onEcouter={() => void ecouter(duel.moi)}
        />
        <Siege
          nom={duel.adversaire ? nom : t('duel.sansAdversaire')}
          avatar={urlAvatar(duel.adversaire?.avatar)}
          prenom={duel.adversaire?.prenom ?? null}
          vide={!duel.adversaire}
          cote={duel.lui}
          vainqueur={issue === 'perdu'}
          /* Their answer opens when mine is in: the seat carries a closed control, so the rule
             is read on the thing itself instead of being explained in a sentence. */
          verrouille={duel.lui.a_parle && !duel.moi.a_parle}
          ecoute={ecoute}
          onEcouter={() => void ecouter(duel.lui)}
        />
      </View>

      {message ? (
        <Text style={[typographie.petit, styles.centre, { color: theme.texteSecondaire }]}>
          {message}
        </Text>
      ) : null}

      {duel.statut === 'ouvert' ? (
        <Ouvert
          duel={duel}
          nom={nom}
          lien={lien}
          onPartager={() => void partager()}
          onCopier={() => void copier()}
          onParler={() => router.push(`/duel/${duel.id}/prise`)}
        />
      ) : duel.statut === 'expire' ? (
        <Carte teinte="douce" style={styles.bloc}>
          <Text style={[typographie.titreCarte, { color: theme.texte }]}>
            {t('duel.expireTitre')}
          </Text>
          <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
            {duel.moi.a_parle
              ? t('duel.expireSansReponse', { nom })
              : t('duel.expireSansMaReponse')}
          </Text>
        </Carte>
      ) : (
        <Verdict duel={duel} nom={nom} />
      )}

      {duel.statut !== 'ouvert' && duel.adversaire ? (
        <Bouton
          libelle={t('duel.revanche')}
          chargement={revanche}
          onPress={() => void relancer()}
        />
      ) : null}

      {duel.statut === 'ouvert' ? (
        <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>
          {t('duel.automatique')}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Bouton libelle={t('commun.retour')} variante="texte" onPress={() => router.back()} />
      </View>
    </ScrollView>
  )
}

/** The end of a duel, worn as a state: a check when it was played out, a slash when nobody came. */
function Badge({ badge }: { badge: 'termine' | 'expire' }) {
  const theme = useTheme()
  const fini = badge === 'termine'
  const couleur = fini ? theme.succes : theme.texteTertiaire
  return (
    <View style={[styles.badge, { borderColor: couleur }]}>
      <Icone
        sf={fini ? 'checkmark.circle.fill' : 'clock.badge.xmark'}
        material={fini ? 'check-circle' : 'schedule'}
        taille={13}
        couleur={couleur}
      />
      <Text style={[styles.badgeTexte, { color: couleur }]}>
        {fini ? t('duel.termine') : t('duel.ligne.expire')}
      </Text>
    </View>
  )
}

/** One seat: who sits there, whether they have spoken, and the take to hear when it may be. */
function Siege({
  moi = false,
  nom,
  prenom = null,
  avatar = null,
  vide = false,
  cote,
  vainqueur,
  verrouille = false,
  ecoute,
  onEcouter,
}: {
  moi?: boolean
  nom: string
  prenom?: string | null
  avatar?: string | null
  vide?: boolean
  cote: CoteDuel
  vainqueur: boolean
  /** Their answer is in and mine is not: the control is closed until I have answered. */
  verrouille?: boolean
  ecoute: Ecoute
  onEcouter: () => void
}) {
  const theme = useTheme()
  const sombre = moi
  const encre = sombre ? couleurs.blanc : theme.texte
  const encreDouce = sombre ? couleurs.encre3 : theme.texteSecondaire
  const duree = dureeCourte(cote.duree_s)
  const etat = cote.a_parle
    ? [t('duel.aParle'), duree].filter(Boolean).join(' · ')
    : t('duel.pasEncoreParle')
  const enLecture = ecoute?.prise === cote.prise_id
  return (
    <View
      style={[
        styles.siege,
        { backgroundColor: sombre ? couleurs.bleuNuit : theme.carte },
        vainqueur && styles.siegeVainqueur,
        !sombre && !theme.sombre && styles.siegeOmbre,
      ]}
    >
      <View style={styles.siegeEntete}>
        {vide ? (
          <View style={[styles.rondToi, { backgroundColor: theme.carteDouce }]}>
            <Icone
              sf="person.badge.plus"
              material="person-add"
              taille={18}
              couleur={theme.texteTertiaire}
            />
          </View>
        ) : (
          <Avatar prenom={prenom} uri={avatar} taille={36} />
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.siegeNom, { color: encre }]} numberOfLines={1}>
            {nom}
          </Text>
          <Text style={[typographie.petit, { color: encreDouce }]} numberOfLines={1}>
            {vide ? '' : etat}
          </Text>
        </View>
        {vainqueur ? (
          <View style={styles.pilule}>
            <Text style={styles.piluleTexte}>{t('duel.vainqueur')}</Text>
          </View>
        ) : null}
      </View>
      {!cote.chemin_audio && cote.a_parle ? (
        <View
          style={[
            styles.ecoute,
            { backgroundColor: sombre ? 'rgba(255, 255, 255, 0.08)' : theme.carteDouce },
          ]}
        >
          <View style={[styles.rondLecture, { backgroundColor: 'transparent' }]}>
            <Icone
              sf={verrouille ? 'lock.fill' : 'speaker.slash.fill'}
              material={verrouille ? 'lock' : 'volume-off'}
              taille={16}
              couleur={encreDouce}
            />
          </View>
          <Text style={[styles.ecouteTexte, { color: encreDouce, flex: 1 }]} numberOfLines={2}>
            {verrouille ? t('duel.apresTaReponse') : t('duel.reponseIndisponible')}
          </Text>
        </View>
      ) : null}
      {cote.chemin_audio ? (
        <View
          style={[
            styles.ecoute,
            { backgroundColor: sombre ? 'rgba(255, 255, 255, 0.12)' : theme.carteDouce },
          ]}
        >
          <ControleLecture
            etat={enLecture ? (ecoute?.etat ?? 'inactif') : 'inactif'}
            depuis={enLecture ? (ecoute?.depuis ?? null) : null}
            dureeS={cote.duree_s}
            onPress={onEcouter}
            diametre={38}
            surFondSombre={sombre}
            libelle={moi ? t('duel.ecouterMaReponse') : t('duel.ecouterSaReponse')}
          />
          <Text style={[styles.ecouteTexte, { color: encre, flex: 1 }]} numberOfLines={1}>
            {enLecture && ecoute?.etat === 'chargement'
              ? t('commun.chargement')
              : enLecture
                ? t('duel.arreter')
                : moi
                  ? t('duel.ecouterMaReponse')
                  : t('duel.ecouterSaReponse')}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

/** While the duel is open: the invitation to send, the take to record, or the wait. */
function Ouvert({
  duel,
  nom,
  lien,
  onPartager,
  onCopier,
  onParler,
}: {
  duel: DuelVue
  nom: string
  lien: string | null
  onPartager: () => void
  onCopier: () => void
  onParler: () => void
}) {
  const theme = useTheme()
  const reste = texteReste(duel.echeance)
  if (!duel.adversaire) {
    return (
      <>
        <Carte teinte="douce" style={styles.bloc}>
          <Text style={[typographie.titreCarte, { color: theme.texte }]}>
            {duel.moi.a_parle ? t('duel.attenteTitre') : t('duel.invitationTitre')}
          </Text>
          <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
            {duel.moi.a_parle ? t('duel.attenteCorpsSansAdversaire') : t('duel.invitationCorps')}
          </Text>
          <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>{reste}</Text>
        </Carte>
        {lien ? <Bouton libelle={t('duel.envoyerInvitation')} onPress={onPartager} /> : null}
        {!duel.moi.a_parle ? (
          <Bouton libelle={t('commun.pret')} variante="blanc" onPress={onParler} />
        ) : null}
        {lien ? (
          <Bouton libelle={t('duel.copierLien')} variante="texte" onPress={onCopier} />
        ) : null}
      </>
    )
  }
  if (!duel.moi.a_parle) {
    return (
      <>
        <Carte teinte="douce" style={styles.bloc}>
          <Text style={[typographie.titreCarte, { color: theme.texte }]}>
            {t('duel.aToiTitre')}
          </Text>
          <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
            {duel.lui.a_parle
              ? t('duel.aToiCorpsRepondu', { nom })
              : t('duel.aToiCorpsAttente', { nom })}
          </Text>
          <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>{reste}</Text>
        </Carte>
        <Bouton libelle={t('commun.pret')} onPress={onParler} />
      </>
    )
  }
  return (
    <Carte teinte="douce" style={styles.bloc}>
      <Text style={[typographie.titreCarte, { color: theme.texte }]}>{t('duel.attenteTitre')}</Text>
      <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
        {t('duel.attenteCorps', { nom })}
      </Text>
      <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>{reste}</Text>
    </Carte>
  )
}

/** The closed duel: the verdict on Rebecca's grid, or the truth while there is none. */
function Verdict({ duel, nom }: { duel: DuelVue; nom: string }) {
  const theme = useTheme()
  const issue = issueDuel(duel)
  const phrase =
    issue === 'gagne'
      ? t('duel.verdictGagne')
      : issue === 'perdu'
        ? t('duel.verdictPerdu', { nom })
        : issue === 'egalite'
          ? t('duel.verdictEgalite')
          : null
  const mesures =
    duel.moi.mesures && duel.lui.mesures ? { moi: duel.moi.mesures, lui: duel.lui.mesures } : null
  return (
    <>
      <Carte teinte="douce" style={styles.bloc}>
        <Text style={[styles.etiquette, { color: theme.lien }]}>
          {phrase ? t('duel.verdictTitre') : t('duel.sansVerdictTitre')}
        </Text>
        <Text
          style={[phrase ? typographie.titreSection : typographie.corps, { color: theme.texte }]}
        >
          {phrase ?? t('duel.sansVerdictCorps')}
        </Text>
      </Carte>
      {mesures ? (
        <Carte style={styles.bloc}>
          <Text style={[styles.etiquette, { color: theme.texteTertiaire }]}>
            {t('duel.mesuresTitre')}
          </Text>
          {/* Who is who is said once, by colour, so no name sits over a column and nothing is
              truncated to make room for it. */}
          <View style={styles.legende}>
            <Jeton couleur={theme.lien} libelle={t('duel.toi')} />
            <Jeton couleur={couleurs.orange} libelle={nom} />
          </View>
          <Mesure
            libelle={t('duel.motsParMin')}
            moi={mesures.moi.mots_par_minute}
            lui={mesures.lui.mots_par_minute}
          />
          <Mesure
            libelle={t('duel.bequilles')}
            moi={mesures.moi.bequilles}
            lui={mesures.lui.bequilles}
          />
          <Mesure
            libelle={t('duel.silences')}
            moi={mesures.moi.silences_tenus}
            lui={mesures.lui.silences_tenus}
          />
        </Carte>
      ) : null}
    </>
  )
}

/** One side of the legend: a dot of its colour, and who it is. */
function Jeton({ couleur, libelle }: { couleur: string; libelle: string }) {
  const theme = useTheme()
  return (
    <View style={styles.jeton}>
      <View style={[styles.pointLegende, { backgroundColor: couleur }]} />
      <Text style={[styles.jetonTexte, { color: theme.texteSecondaire }]} numberOfLines={1}>
        {libelle}
      </Text>
    </View>
  )
}

/**
 * One measure, the two sides on one row: the label, then each number in its own colour over a
 * bar drawn to its share of the two, so the comparison is read without reading the figures.
 */
function Mesure({
  libelle,
  moi,
  lui,
}: {
  libelle: string
  moi: number | null
  lui: number | null
}) {
  const theme = useTheme()
  const texte = (valeur: number | null) => (valeur === null ? '·' : String(Math.round(valeur)))
  const haut = Math.max(moi ?? 0, lui ?? 0, 1)
  return (
    <View style={styles.mesureBloc}>
      <Text style={[typographie.petit, { color: theme.texteSecondaire }]}>{libelle}</Text>
      <View style={styles.mesureLigne}>
        <Cote valeur={texte(moi)} part={(moi ?? 0) / haut} couleur={theme.lien} />
        <Cote valeur={texte(lui)} part={(lui ?? 0) / haut} couleur={couleurs.orange} />
      </View>
    </View>
  )
}

function Cote({ valeur, part, couleur }: { valeur: string; part: number; couleur: string }) {
  const theme = useTheme()
  return (
    <View style={styles.cote}>
      <Text style={[styles.valeur, { color: couleur }]}>{valeur}</Text>
      <View style={[styles.piste, { backgroundColor: theme.carteDouce }]}>
        <View
          style={[
            styles.remplissage,
            { backgroundColor: couleur, width: `${Math.max(6, Math.round(part * 100))}%` },
          ]}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  contenu: { flexGrow: 1, paddingHorizontal: espaces.xl, gap: espaces.m },
  entete: { flexDirection: 'row', alignItems: 'center', gap: espaces.s },
  surtitre: { fontFamily: polices.extraBold, fontSize: 17, lineHeight: 22 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: rayons.pilule,
    borderWidth: 1.5,
  },
  badgeTexte: {
    fontFamily: polices.extraBold,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  bloc: { gap: espaces.s },
  centre: { textAlign: 'center' },
  actions: { marginTop: 'auto', paddingTop: espaces.l },
  sieges: { gap: espaces.s },
  siege: {
    padding: espaces.m,
    borderRadius: rayons.xxl,
    gap: espaces.s,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  siegeVainqueur: { borderColor: couleurs.or },
  siegeOmbre: {
    shadowColor: couleurs.bleuNuit,
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  siegeEntete: { flexDirection: 'row', alignItems: 'center', gap: espaces.s },
  siegeNom: { fontFamily: polices.extraBold, fontSize: 16, lineHeight: 20 },
  rondToi: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pilule: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: rayons.pilule,
    backgroundColor: couleurs.or,
  },
  piluleTexte: {
    fontFamily: polices.extraBold,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: couleurs.bleuNuit,
  },
  ecoute: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaces.s,
    paddingVertical: espaces.xs,
    paddingHorizontal: espaces.s,
    borderRadius: rayons.m,
  },
  rondLecture: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ecouteTexte: { fontFamily: polices.bold, fontSize: 14, lineHeight: 18 },
  etiquette: {
    fontFamily: polices.extraBold,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  legende: { flexDirection: 'row', flexWrap: 'wrap', gap: espaces.m, paddingBottom: espaces.xxs },
  jeton: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '55%' },
  pointLegende: { width: 9, height: 9, borderRadius: 5 },
  jetonTexte: { fontFamily: polices.bold, fontSize: 12.5, lineHeight: 16 },
  mesureBloc: { gap: 5 },
  mesureLigne: { flexDirection: 'row', alignItems: 'flex-end', gap: espaces.m },
  cote: { flex: 1, gap: 4 },
  valeur: { fontFamily: polices.extraBold, fontSize: 20, lineHeight: 24 },
  piste: { height: 6, borderRadius: 3, overflow: 'hidden' },
  remplissage: { height: 6, borderRadius: 3 },
})
