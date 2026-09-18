import { issueDuel, lienInvitationDuel, type CoteDuel, type DuelVue } from '@leq/domaine'
import { useQueryClient } from '@tanstack/react-query'
import * as Clipboard from 'expo-clipboard'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Avatar } from '@/components/Avatar'
import { EcranChargement, EcranErreur } from '@/components/EcransEtat'
import { Bouton } from '@/components/ui/Bouton'
import { Carte } from '@/components/ui/Carte'
import { Icone } from '@/components/ui/Icone'
import { Titre } from '@/components/ui/Titre'
import { t } from '@/i18n/fr'
import { useActualisation } from '@/services/actualisation'
import { creerDuel, invaliderArene, messageRefus, useMesDuels } from '@/services/arene'
import { dureeCourte, texteReste } from '@/services/delai'
import { nomAdversaire } from '@/services/duelVue'
import { lecteur, urlSignee } from '@/services/lecture'
import { urlAvatar } from '@/services/photo'
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

type Ecoute = { prise: string; etat: 'chargement' | 'lecture' } | null

export default function EcranDuel() {
  const params = useLocalSearchParams<{ id?: string }>()
  const id = typeof params.id === 'string' ? params.id : null
  const theme = useTheme()
  const { enCours: actualisation, actualiser } = useActualisation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const clientRequetes = useQueryClient()
  const duels = useMesDuels()
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
      setEcoute({ prise: cote.prise_id, etat: 'lecture' })
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

  const surtitre = [
    duel.adversaire ? t('duel.contre', { nom }) : t('duel.surtitre'),
    duel.statut === 'ouvert' ? t('duel.ouvert') : t('duel.termine'),
  ].join(' · ')

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
      <Text style={[styles.surtitre, { color: theme.accent }]}>{surtitre}</Text>
      <Titre niveau="ecran">{duel.sujet}</Titre>

      <View style={styles.sieges}>
        <Siege
          moi
          nom={t('duel.toi')}
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

      <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>
        {t('duel.automatique')}
      </Text>

      <View style={styles.actions}>
        <Bouton libelle={t('commun.retour')} variante="texte" onPress={() => router.back()} />
      </View>
    </ScrollView>
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
        {moi ? (
          <View style={[styles.rondToi, { backgroundColor: couleurs.or }]}>
            <Icone sf="person.fill" material="person" taille={18} couleur={couleurs.bleuNuit} />
          </View>
        ) : vide ? (
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
      {cote.chemin_audio ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            enLecture
              ? t('duel.arreter')
              : moi
                ? t('duel.ecouterMaReponse')
                : t('duel.ecouterSaReponse')
          }
          accessibilityState={{ busy: enLecture && ecoute?.etat === 'chargement' }}
          onPress={onEcouter}
          style={({ pressed }) => [
            styles.ecoute,
            { backgroundColor: sombre ? 'rgba(255, 255, 255, 0.12)' : theme.carteDouce },
            pressed && { opacity: 0.85 },
          ]}
        >
          <View
            style={[styles.rondLecture, { backgroundColor: enLecture ? couleurs.or : theme.lien }]}
          >
            <Icone
              sf={enLecture && ecoute?.etat === 'lecture' ? 'stop.fill' : 'play.fill'}
              material={enLecture && ecoute?.etat === 'lecture' ? 'stop' : 'play-arrow'}
              taille={14}
              couleur={enLecture ? couleurs.bleuNuit : couleurs.blanc}
            />
          </View>
          <Text style={[styles.ecouteTexte, { color: encre }]}>
            {enLecture && ecoute?.etat === 'chargement'
              ? t('commun.chargement')
              : enLecture
                ? t('duel.arreter')
                : moi
                  ? t('duel.ecouterMaReponse')
                  : t('duel.ecouterSaReponse')}
          </Text>
        </Pressable>
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
    <Carte teinte="douce" style={styles.bloc}>
      <Text style={[styles.etiquette, { color: theme.lien }]}>
        {phrase ? t('duel.verdictTitre') : t('duel.sansVerdictTitre')}
      </Text>
      <Text style={[phrase ? typographie.titreSection : typographie.corps, { color: theme.texte }]}>
        {phrase ?? t('duel.sansVerdictCorps')}
      </Text>
      {mesures ? (
        <View style={styles.mesures}>
          <Text style={[styles.etiquette, { color: theme.texteTertiaire }]}>
            {t('duel.mesuresTitre')}
          </Text>
          <View style={styles.mesuresEntete}>
            <View style={{ flex: 1 }} />
            <Text style={[styles.colonne, { color: theme.texte }]}>{t('duel.toi')}</Text>
            <Text style={[styles.colonne, { color: theme.texte }]} numberOfLines={1}>
              {nom}
            </Text>
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
        </View>
      ) : null}
    </Carte>
  )
}

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
  return (
    <View style={styles.mesureLigne}>
      <Text style={[typographie.petit, { color: theme.texteSecondaire, flex: 1 }]}>{libelle}</Text>
      <Text style={[styles.valeur, { color: theme.texte }]}>{texte(moi)}</Text>
      <Text style={[styles.valeur, { color: theme.texte }]}>{texte(lui)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  contenu: { flexGrow: 1, paddingHorizontal: espaces.xl, gap: espaces.m },
  surtitre: {
    fontFamily: polices.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.1,
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
  mesures: { gap: espaces.xs, paddingTop: espaces.xs },
  mesuresEntete: { flexDirection: 'row', alignItems: 'center' },
  colonne: {
    width: 72,
    textAlign: 'right',
    fontFamily: polices.bold,
    fontSize: 12,
    lineHeight: 16,
  },
  mesureLigne: { flexDirection: 'row', alignItems: 'center' },
  valeur: {
    width: 72,
    textAlign: 'right',
    fontFamily: polices.extraBold,
    fontSize: 16,
    lineHeight: 20,
  },
})
