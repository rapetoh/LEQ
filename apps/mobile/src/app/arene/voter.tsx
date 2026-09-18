import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Bulle } from '@/components/Bulle'
import { ControleLecture } from '@/components/ControleLecture'
import { EcranChargement } from '@/components/EcransEtat'
import { Bouton } from '@/components/ui/Bouton'
import { Degrade } from '@/components/ui/Degrade'
import { Titre } from '@/components/ui/Titre'
import { t } from '@/i18n/fr'
import {
  chargerPaire,
  invaliderArene,
  messageRefus,
  voter,
  type PaireAVoter,
} from '@/services/arene'
import { useConfiguration } from '@/services/configuration'
import { dureeCourte, maintenant } from '@/services/delai'
import { compter } from '@/services/usage'
import { lecteur, urlSignee } from '@/services/lecture'
import { supabase } from '@/services/supabase'
import { useTheme } from '@/theme/ThemeProvider'
import { couleurs, espaces, polices, rayons, typographie } from '@/theme/tokens'

// C7 · Le vote, par paires. Two voices, you choose one, next pair. Anonymous until your vote;
// never your own take, never the same pair twice. The screen carries three things a person
// needs and had to guess at: where the listening has got in the day's allowance, how long each
// voice speaks, and how far into a voice they are while it plays.

type Etat =
  | { phase: 'chargement' }
  | { phase: 'paire'; paire: Extract<PaireAVoter, { raison: 'ok' }>; numero: number }
  | { phase: 'fini'; raison: 'parle_d_abord' }
  | { phase: 'fini'; raison: 'aucun_sujet' }
  | { phase: 'fini'; raison: 'assez_ecoute'; plafond: number }
  | { phase: 'fini'; raison: 'rien_a_comparer'; autres: number }
  | { phase: 'erreur'; message: string }

type Ecoute = { prise: string; etat: 'chargement' | 'lecture'; depuis?: number } | null

export default function Voter() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const clientRequetes = useQueryClient()
  const configuration = useConfiguration()
  const points = configuration.data?.points_par_vote ?? 5
  const [etat, setEtat] = useState<Etat>({ phase: 'chargement' })
  const [gagnes, setGagnes] = useState(0)
  const [ecoute, setEcoute] = useState<Ecoute>(null)
  const [envoi, setEnvoi] = useState(false)
  const [messageLecture, setMessageLecture] = useState<string | null>(null)

  const suivante = useCallback(async (numero: number, premier = false) => {
    if (!premier) setEtat({ phase: 'chargement' })
    try {
      const paire = await chargerPaire()
      if (paire.raison === 'ok') setEtat({ phase: 'paire', paire, numero })
      else if (paire.raison === 'rien_a_comparer')
        setEtat({ phase: 'fini', raison: 'rien_a_comparer', autres: paire.autres })
      else if (paire.raison === 'assez_ecoute')
        setEtat({ phase: 'fini', raison: 'assez_ecoute', plafond: paire.plafond })
      else setEtat({ phase: 'fini', raison: paire.raison })
    } catch (erreur) {
      setEtat({ phase: 'erreur', message: messageRefus(erreur) })
    }
  }, [])

  useEffect(() => {
    // The first pair is drawn after the first paint: the screen already shows its waiting state.
    const minuteur = setTimeout(() => void suivante(1, true), 0)
    return () => {
      clearTimeout(minuteur)
      lecteur.arreter()
    }
  }, [suivante])

  const ecouter = async (priseId: string) => {
    if (ecoute?.prise === priseId) {
      if (ecoute.etat === 'chargement') return
      lecteur.arreter()
      setEcoute(null)
      return
    }
    setMessageLecture(null)
    setEcoute({ prise: priseId, etat: 'chargement' })
    try {
      const { data, error } = await supabase
        .from('prises_publiques')
        .select('chemin_audio')
        .eq('id', priseId)
        .maybeSingle()
      if (error) throw new Error(error.message)
      const chemin = (data as { chemin_audio?: string | null } | null)?.chemin_audio
      // A take whose audio is gone, or withdrawn by moderation: say it, rather than a control
      // that does nothing twice and leaves the person voting on a voice they never heard.
      if (!chemin) {
        setEcoute(null)
        setMessageLecture(t('arene.lectureIndisponible'))
        return
      }
      await lecteur.jouer(await urlSignee(chemin), () => setEcoute(null))
      setEcoute({ prise: priseId, etat: 'lecture', depuis: maintenant() })
    } catch (erreur) {
      console.warn('arène: lecture impossible', erreur)
      setEcoute(null)
      setMessageLecture(t('arene.lectureEchouee'))
    }
  }

  const choisir = async (gagnante: string, perdante: string, numero: number) => {
    setEnvoi(true)
    lecteur.arreter()
    setEcoute(null)
    try {
      await voter(gagnante, perdante)
      compter('arene_vote')
      setGagnes((courants) => courants + points)
      invaliderArene(clientRequetes)
      await suivante(numero + 1)
    } catch (erreur) {
      setEtat({ phase: 'erreur', message: messageRefus(erreur) })
    } finally {
      setEnvoi(false)
    }
  }

  if (etat.phase === 'chargement') return <EcranChargement />

  return (
    <ScrollView
      style={{ backgroundColor: theme.fond }}
      contentContainerStyle={[
        styles.contenu,
        { paddingTop: insets.top + espaces.l, paddingBottom: insets.bottom + espaces.xl },
      ]}
    >
      {etat.phase === 'paire' ? (
        <>
          <EcouteDuJour
            ecoutees={etat.paire.ecoutees}
            plafond={etat.paire.plafond}
            gagnes={gagnes}
          />

          <View style={styles.heroOmbre}>
            <View style={styles.hero}>
              <Degrade de={couleurs.bleu} a={couleurs.bleuNuit} rayon={26} id="voter" />
              <Text style={styles.heroEtiquette}>{t('arene.sujetSemaine')}</Text>
              <Text style={styles.heroTitre}>{etat.paire.sujet.texte}</Text>
              <Text style={styles.heroNote}>{t('arene.anonymes')}</Text>
            </View>
          </View>

          {messageLecture ? (
            <Text style={[typographie.petit, styles.centreTexte, { color: theme.accent }]}>
              {messageLecture}
            </Text>
          ) : null}

          {[etat.paire.a, etat.paire.b].map((prise, index) => (
            <View key={prise.id} style={styles.groupe}>
              {index === 1 ? (
                <View style={styles.ou}>
                  <View style={[styles.trait, { backgroundColor: theme.bordure }]} />
                  <Text style={[styles.ouTexte, { color: theme.texteTertiaire }]}>
                    {t('arene.ou')}
                  </Text>
                  <View style={[styles.trait, { backgroundColor: theme.bordure }]} />
                </View>
              ) : null}
              <CarteVoix
                lettre={index === 0 ? 'A' : 'B'}
                dureeS={prise.duree_s}
                etat={ecoute?.prise === prise.id ? ecoute.etat : 'inactif'}
                depuis={ecoute?.prise === prise.id ? (ecoute.depuis ?? null) : null}
                envoi={envoi}
                onEcouter={() => void ecouter(prise.id)}
                onChoisir={() =>
                  void choisir(
                    prise.id,
                    prise.id === etat.paire.a.id ? etat.paire.b.id : etat.paire.a.id,
                    etat.numero,
                  )
                }
              />
            </View>
          ))}
        </>
      ) : (
        <Fin etat={etat} gagnes={gagnes} onRetour={() => router.back()} />
      )}

      <View style={styles.actions}>
        <Bouton libelle={t('commun.retour')} variante="texte" onPress={() => router.back()} />
      </View>
    </ScrollView>
  )
}

/** Where the listening has got in the day's allowance, and what the votes have earned so far. */
function EcouteDuJour({
  ecoutees,
  plafond,
  gagnes,
}: {
  ecoutees: number
  plafond: number
  gagnes: number
}) {
  const theme = useTheme()
  if (plafond <= 0 && gagnes === 0) return null
  const part = plafond > 0 ? Math.min(1, ecoutees / plafond) : 0
  return (
    <View style={styles.jour}>
      <View style={styles.ligne}>
        {plafond > 0 ? (
          <Text style={[styles.etiquette, { color: theme.texteTertiaire, flex: 1 }]}>
            {ecoutees === 1
              ? t('arene.ecouteDuJourUn', { plafond })
              : t('arene.ecouteDuJour', { ecoutees, plafond })}
          </Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        {gagnes > 0 ? (
          <Text style={[styles.etiquette, { color: theme.accent }]}>
            {t('arene.pointsGagnes', { points: gagnes })}
          </Text>
        ) : null}
      </View>
      {plafond > 0 ? (
        <View style={[styles.piste, { backgroundColor: theme.carteDouce }]}>
          <View
            style={[
              styles.remplissage,
              { backgroundColor: theme.accent, width: `${Math.round(part * 100)}%` },
            ]}
          />
        </View>
      ) : null}
    </View>
  )
}

/** One of the two voices: which one it is, how long it speaks, and the choice it asks for. */
function CarteVoix({
  lettre,
  dureeS,
  etat,
  depuis,
  envoi,
  onEcouter,
  onChoisir,
}: {
  lettre: 'A' | 'B'
  dureeS: number | null
  etat: 'inactif' | 'chargement' | 'lecture'
  depuis: number | null
  envoi: boolean
  onEcouter: () => void
  onChoisir: () => void
}) {
  const theme = useTheme()
  const couleur = lettre === 'A' ? couleurs.or : theme.lien
  const encre = lettre === 'A' ? couleurs.bleuNuit : couleurs.blanc
  const duree = dureeCourte(dureeS)
  return (
    <View
      style={[styles.carte, { backgroundColor: theme.carte }, !theme.sombre && styles.ombreCarte]}
    >
      <View style={styles.ligne}>
        <View style={[styles.pastille, { backgroundColor: couleur }]}>
          <Text style={[styles.pastilleTexte, { color: encre }]}>{lettre}</Text>
        </View>
        <Text style={[styles.nomVoix, { color: theme.texte, flex: 1 }]}>
          {lettre === 'A' ? t('arene.voixA') : t('arene.voixB')}
        </Text>
        {duree ? (
          <View style={[styles.pilule, { backgroundColor: theme.carteDouce }]}>
            <Text style={[styles.piluleTexte, { color: theme.texteSecondaire }]}>{duree}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.centreLecture}>
        <ControleLecture
          etat={etat}
          depuis={depuis}
          dureeS={dureeS}
          onPress={onEcouter}
          diametre={76}
          couleur={couleur}
          libelle={t('arene.ecouterPassageLettre', { lettre })}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={envoi}
        onPress={onChoisir}
        style={({ pressed }) => [
          styles.choisir,
          { backgroundColor: theme.accentDoux },
          (pressed || envoi) && { opacity: 0.7 },
        ]}
      >
        <Text style={[styles.choisirTexte, { color: couleurs.rouge }]}>{t('arene.choisir')}</Text>
      </Pressable>
    </View>
  )
}

/** Nothing to compare, or the day's listening done: the screen says which, and what comes next. */
function Fin({
  etat,
  gagnes,
  onRetour,
}: {
  etat: Extract<Etat, { phase: 'fini' } | { phase: 'erreur' }>
  gagnes: number
  onRetour: () => void
}) {
  const theme = useTheme()
  const titre =
    etat.phase === 'erreur'
      ? t('erreurs.generique')
      : etat.raison === 'parle_d_abord'
        ? t('arene.parleDAbordTitre')
        : etat.raison === 'aucun_sujet'
          ? t('arene.aucunSujetTitre')
          : etat.raison === 'assez_ecoute'
            ? t('arene.assezEcouteTitre', { plafond: etat.plafond })
            : etat.autres === 0
              ? t('arene.seulPassageTitre')
              : etat.autres === 1
                ? t('arene.unSeulAutreTitre')
                : t('arene.rienAComparerTitre')
  const corps =
    etat.phase === 'erreur'
      ? etat.message
      : etat.raison === 'parle_d_abord'
        ? t('arene.parleDAbordCorps')
        : etat.raison === 'aucun_sujet'
          ? t('arene.aucunSujetCorps')
          : etat.raison === 'assez_ecoute'
            ? t('arene.assezEcouteCorps')
            : etat.autres === 0
              ? t('arene.seulPassageCorps')
              : etat.autres === 1
                ? t('arene.unSeulAutreCorps')
                : t('arene.rienAComparerCorps')
  return (
    <View style={styles.centre}>
      <Bulle taille="moyenne" visage="sourit" />
      <Titre niveau="ecran" centre>
        {titre}
      </Titre>
      <Text style={[typographie.corps, styles.centreTexte, { color: theme.texteSecondaire }]}>
        {corps}
      </Text>
      {gagnes > 0 ? (
        <Text style={[typographie.corpsFort, { color: theme.accent }]}>
          {t('arene.pointsGagnes', { points: gagnes })}
        </Text>
      ) : null}
      {etat.phase === 'fini' && etat.raison === 'rien_a_comparer' && etat.autres === 1 ? (
        <Bouton
          libelle={t('arene.ecouterClassement')}
          variante="secondaire"
          onPress={onRetour}
          style={{ alignSelf: 'stretch' }}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  contenu: { flexGrow: 1, paddingHorizontal: espaces.xl, gap: espaces.m },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espaces.s },
  etiquette: {
    fontFamily: polices.extraBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  jour: { gap: espaces.xs },
  piste: { height: 6, borderRadius: 3, overflow: 'hidden' },
  remplissage: { height: 6, borderRadius: 3 },
  heroOmbre: {
    borderRadius: 26,
    shadowColor: couleurs.bleu,
    shadowOpacity: 0.28,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 12 },
    elevation: 7,
  },
  hero: { gap: 10, padding: espaces.xl, borderRadius: 26, overflow: 'hidden' },
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
    fontSize: 23,
    lineHeight: 27,
    letterSpacing: -0.6,
    color: couleurs.blanc,
  },
  heroNote: {
    fontFamily: polices.semiBold,
    fontSize: 11.5,
    lineHeight: 16,
    color: couleurs.encre2,
  },
  groupe: { gap: espaces.m },
  ou: { flexDirection: 'row', alignItems: 'center', gap: espaces.s },
  trait: { flex: 1, height: StyleSheet.hairlineWidth },
  ouTexte: {
    fontFamily: polices.extraBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  carte: { padding: espaces.l, borderRadius: rayons.xxl, gap: espaces.m },
  ombreCarte: {
    shadowColor: couleurs.bleuNuit,
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  pastille: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pastilleTexte: { fontFamily: polices.extraBold, fontSize: 15, lineHeight: 19 },
  nomVoix: { fontFamily: polices.extraBold, fontSize: 16, lineHeight: 21 },
  pilule: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: rayons.pilule },
  piluleTexte: { fontFamily: polices.bold, fontSize: 12.5, lineHeight: 16 },
  centreLecture: { alignItems: 'center', paddingVertical: espaces.xs },
  choisir: {
    minHeight: 52,
    borderRadius: rayons.l,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: espaces.m,
  },
  choisirTexte: { fontFamily: polices.extraBold, fontSize: 15, lineHeight: 20 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: espaces.m },
  centreTexte: { textAlign: 'center' },
  actions: { marginTop: 'auto', paddingTop: espaces.l },
})
