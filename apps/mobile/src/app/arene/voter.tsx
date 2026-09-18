import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Bulle } from '@/components/Bulle'
import { EcranChargement } from '@/components/EcransEtat'
import { Bouton } from '@/components/ui/Bouton'
import { Icone } from '@/components/ui/Icone'
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
import { dureeCourte } from '@/services/delai'
import { compter } from '@/services/usage'
import { lecteur, urlSignee } from '@/services/lecture'
import { supabase } from '@/services/supabase'
import { useTheme } from '@/theme/ThemeProvider'
import { couleurs, espaces, polices, rayons, typographie } from '@/theme/tokens'

// C7 · Le vote, par paires. Two voices, you choose one, next pair. Anonymous until your vote;
// never your own take, never the same pair twice. When there is no pair, the screen says why:
// nobody else yet, one other voice (to hear in the ranking), or every pair heard.

type Etat =
  | { phase: 'chargement' }
  | { phase: 'paire'; paire: Extract<PaireAVoter, { raison: 'ok' }>; numero: number }
  | { phase: 'fini'; raison: 'parle_d_abord' | 'aucun_sujet' | 'assez_ecoute' }
  | { phase: 'fini'; raison: 'rien_a_comparer'; autres: number }
  | { phase: 'erreur'; message: string }

export default function Voter() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const clientRequetes = useQueryClient()
  const configuration = useConfiguration()
  const points = configuration.data?.points_par_vote ?? 5
  const [etat, setEtat] = useState<Etat>({ phase: 'chargement' })
  const [gagnes, setGagnes] = useState(0)
  const [enCours, setEnCours] = useState<{ prise: string; etat: 'chargement' | 'lecture' } | null>(
    null,
  )
  const [envoi, setEnvoi] = useState(false)
  const [messageLecture, setMessageLecture] = useState<string | null>(null)

  const suivante = useCallback(async (numero: number, premier = false) => {
    if (!premier) setEtat({ phase: 'chargement' })
    try {
      const paire = await chargerPaire()
      if (paire.raison === 'ok') setEtat({ phase: 'paire', paire, numero })
      else if (paire.raison === 'rien_a_comparer')
        setEtat({ phase: 'fini', raison: 'rien_a_comparer', autres: paire.autres })
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
    if (enCours?.prise === priseId) {
      if (enCours.etat === 'chargement') return
      lecteur.arreter()
      setEnCours(null)
      return
    }
    setMessageLecture(null)
    setEnCours({ prise: priseId, etat: 'chargement' })
    try {
      const { data, error } = await supabase
        .from('prises_publiques')
        .select('chemin_audio')
        .eq('id', priseId)
        .maybeSingle()
      if (error) throw new Error(error.message)
      const chemin = (data as { chemin_audio?: string | null } | null)?.chemin_audio
      // A take whose audio is gone, or withdrawn by moderation: say it, rather than a button
      // that does nothing twice and leaves the person voting on a voice they never heard.
      if (!chemin) {
        setEnCours(null)
        setMessageLecture(t('arene.lectureIndisponible'))
        return
      }
      await lecteur.jouer(await urlSignee(chemin), () => setEnCours(null))
      setEnCours({ prise: priseId, etat: 'lecture' })
    } catch (erreur) {
      console.warn('arène: lecture impossible', erreur)
      setEnCours(null)
      setMessageLecture(t('arene.lectureEchouee'))
    }
  }

  const choisir = async (gagnante: string, perdante: string, numero: number) => {
    setEnvoi(true)
    lecteur.arreter()
    setEnCours(null)
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

  // How many other voices there are when no pair could be drawn; null in every other state.
  const autres = etat.phase === 'fini' && etat.raison === 'rien_a_comparer' ? etat.autres : null
  const finTitre =
    etat.phase === 'erreur'
      ? t('erreurs.generique')
      : etat.phase === 'fini'
        ? etat.raison === 'parle_d_abord'
          ? t('arene.parleDAbordTitre')
          : etat.raison === 'aucun_sujet'
            ? t('arene.aucunSujetTitre')
            : etat.raison === 'assez_ecoute'
              ? t('arene.assezEcouteTitre')
              : autres === 0
                ? t('arene.seulPassageTitre')
                : autres === 1
                  ? t('arene.unSeulAutreTitre')
                  : t('arene.rienAComparerTitre')
        : ''
  const finCorps =
    etat.phase === 'erreur'
      ? etat.message
      : etat.phase === 'fini'
        ? etat.raison === 'parle_d_abord'
          ? t('arene.parleDAbordCorps')
          : etat.raison === 'aucun_sujet'
            ? t('arene.aucunSujetCorps')
            : etat.raison === 'assez_ecoute'
              ? t('arene.assezEcouteCorps')
              : autres === 0
                ? t('arene.seulPassageCorps')
                : autres === 1
                  ? t('arene.unSeulAutreCorps')
                  : t('arene.rienAComparerCorps')
        : ''

  return (
    <ScrollView
      style={{ backgroundColor: theme.fond }}
      contentContainerStyle={[
        styles.contenu,
        { paddingTop: insets.top + espaces.xl, paddingBottom: insets.bottom + espaces.xl },
      ]}
    >
      {etat.phase === 'paire' ? (
        <>
          <View style={styles.ligne}>
            <Text style={[styles.etiquette, { color: theme.texteTertiaire, flex: 1 }]}>
              {t('arene.paire', { numero: etat.numero })}
            </Text>
            {gagnes > 0 ? (
              <Text style={[styles.etiquette, { color: theme.lien }]}>
                {t('arene.pointsGagnes', { points: gagnes })}
              </Text>
            ) : null}
          </View>
          <Titre niveau="section" centre>
            {etat.paire.sujet.texte}
          </Titre>
          <Text style={[typographie.petit, styles.centreTexte, { color: theme.texteTertiaire }]}>
            {t('arene.anonymes')}
          </Text>
          {messageLecture ? (
            <Text style={[typographie.petit, styles.centreTexte, { color: theme.accent }]}>
              {messageLecture}
            </Text>
          ) : null}
          {[etat.paire.a, etat.paire.b].map((prise, index) => {
            const lettre = index === 0 ? 'A' : 'B'
            const enLecture = enCours?.prise === prise.id
            const duree = dureeCourte(prise.duree_s)
            return (
              <View key={prise.id} style={styles.groupe}>
                {index === 1 ? (
                  <Text style={[styles.ou, { color: theme.texteTertiaire }]}>{t('arene.ou')}</Text>
                ) : null}
                <View
                  style={[
                    styles.carte,
                    { backgroundColor: theme.carte },
                    !theme.sombre && styles.ombre,
                  ]}
                >
                  <View style={styles.ligne}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        enLecture ? t('arene.arreter') : t('arene.ecouterVoix', { lettre })
                      }
                      accessibilityState={{ busy: enLecture && enCours?.etat === 'chargement' }}
                      onPress={() => void ecouter(prise.id)}
                      style={({ pressed }) => [
                        styles.lecture,
                        { backgroundColor: enLecture ? theme.texte : theme.lien },
                        pressed && { opacity: 0.85 },
                        enLecture && enCours?.etat === 'chargement' && { opacity: 0.6 },
                      ]}
                    >
                      <Icone
                        sf={enLecture && enCours?.etat === 'lecture' ? 'stop.fill' : 'play.fill'}
                        material={enLecture && enCours?.etat === 'lecture' ? 'stop' : 'play-arrow'}
                        taille={22}
                        couleur={couleurs.blanc}
                      />
                    </Pressable>
                    <Text style={[styles.lettre, { color: theme.texte, flex: 1 }]}>{lettre}</Text>
                    {duree ? (
                      <Text style={[styles.duree, { color: theme.texteSecondaire }]}>{duree}</Text>
                    ) : null}
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    disabled={envoi}
                    onPress={() =>
                      void choisir(
                        prise.id,
                        prise.id === etat.paire.a.id ? etat.paire.b.id : etat.paire.a.id,
                        etat.numero,
                      )
                    }
                    style={({ pressed }) => [
                      styles.choisir,
                      { backgroundColor: theme.accentDoux },
                      (pressed || envoi) && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={[styles.choisirTexte, { color: couleurs.rouge }]}>
                      {t('arene.choisir')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )
          })}
        </>
      ) : (
        <View style={styles.centre}>
          <Bulle taille="moyenne" visage="sourit" />
          <Titre niveau="ecran" centre>
            {finTitre}
          </Titre>
          <Text style={[typographie.corps, styles.centreTexte, { color: theme.texteSecondaire }]}>
            {finCorps}
          </Text>
          {gagnes > 0 ? (
            <Text style={[typographie.corpsFort, { color: theme.accent }]}>
              {t('arene.pointsGagnes', { points: gagnes })}
            </Text>
          ) : null}
          {autres === 1 ? (
            <Bouton
              libelle={t('arene.ecouterClassement')}
              variante="secondaire"
              onPress={() => router.back()}
              style={{ alignSelf: 'stretch' }}
            />
          ) : null}
        </View>
      )}

      <View style={styles.actions}>
        <Bouton libelle={t('commun.retour')} variante="texte" onPress={() => router.back()} />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  contenu: { flexGrow: 1, paddingHorizontal: espaces.xl, gap: espaces.m },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espaces.s },
  etiquette: {
    fontFamily: polices.extraBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  groupe: { gap: espaces.m },
  ou: {
    textAlign: 'center',
    fontFamily: polices.extraBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  carte: { padding: espaces.m, borderRadius: rayons.xxl, gap: espaces.m },
  ombre: {
    shadowColor: couleurs.bleuNuit,
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  lecture: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lettre: { fontFamily: polices.extraBold, fontSize: 20, lineHeight: 24 },
  duree: { fontFamily: polices.bold, fontSize: 14, lineHeight: 18 },
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
