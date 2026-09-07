import { MesuresSchema } from '@leq/domaine'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Bulle } from '@/components/Bulle'
import { Bouton } from '@/components/ui/Bouton'
import { Carte } from '@/components/ui/Carte'
import { Titre } from '@/components/ui/Titre'
import { useSuiviPrise } from '@/hooks/useSuiviPrise'
import { t } from '@/i18n/fr'
import { useDemarrage } from '@/services/configuration'
import { activerNotifications } from '@/services/notifications'
import { CLE_CARTE, CLE_ETAPE_DU_JOUR } from '@/services/parcours'
import { invaliderProgres , useSerie } from '@/services/progres'
import { file } from '@/services/prises'
import { ecrireProfilLocal } from '@/services/profilLocal'
import { supabase } from '@/services/supabase'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, typographie } from '@/theme/tokens'

// A5 · L'analyse, X2 · L'envoi, X3 · L'analyse a échoué: one screen, several states.
// Bulle says what is really happening; the person may leave and be told when it is ready.
// `suite` decides where a ready take goes: the diagnostic profile (A6) or the feedback (B5).

const ETAPES = ['etapeRythme', 'etapeBequilles', 'etapeProfil'] as const

function etapeCourante(statut: string): number {
  if (statut === 'envoyee' || statut === 'en_transcription') return 0
  if (statut === 'en_mesure') return 1
  return 2
}

export function EcranAnalyse({ id, suite }: { id: string | null; suite: 'profil' | 'retour' }) {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const clientRequetes = useQueryClient()
  const { marquerAccueilTermine } = useDemarrage()
  const suivi = useSuiviPrise(id)
  const serie = useSerie()
  const [erreurLecture, setErreurLecture] = useState(false)

  useEffect(() => {
    if (suivi.phase !== 'pret' || !id) return
    let actif = true
    void (async () => {
      void clientRequetes.invalidateQueries({ queryKey: CLE_ETAPE_DU_JOUR })
      void clientRequetes.invalidateQueries({ queryKey: CLE_CARTE })
      invaliderProgres(clientRequetes)
      if (suite === 'retour') {
        router.replace({ pathname: '/retour/[tentativeId]', params: { tentativeId: id } })
        return
      }
      const { data, error } = await supabase
        .from('analyses')
        .select('mesures')
        .eq('tentative_id', id)
        .maybeSingle()
      if (!actif) return
      const mesures = MesuresSchema.safeParse(data?.mesures)
      if (error || !mesures.success) {
        setErreurLecture(true)
        return
      }
      await ecrireProfilLocal({
        tentative_id: id,
        enregistre_le: new Date().toISOString(),
        mesures: mesures.data,
      })
      router.replace('/accueil/profil')
    })()
    return () => {
      actif = false
    }
  }, [suivi.phase, id, router, suite, clientRequetes])

  const quitter = () => {
    void activerNotifications().finally(() => {
      if (suite === 'profil') marquerAccueilTermine()
      router.replace('/(onglets)/aujourdhui')
    })
  }

  let titre = t('analyse.enCours')
  let corps: string | null = t('analyse.effacement')
  let echec: 'telephone' | 'serveur' | null = null
  let etape = 0
  if (suivi.phase === 'telephone') {
    if (suivi.aEchoue) {
      echec = 'telephone'
      titre = t('analyse.echecTitre')
      corps = t('analyse.echecCorps')
    } else if (suivi.horsLigne || suivi.entree.etat === 'en_attente_reseau') {
      titre = t('analyse.attenteReseau')
      corps = t('analyse.attenteReseauDetail')
    } else {
      titre = t('analyse.envoi')
      corps = t('analyse.envoiDetail')
    }
  } else if (suivi.phase === 'serveur') {
    etape = etapeCourante(suivi.statut)
  } else if (suivi.phase === 'echec_serveur' || erreurLecture) {
    echec = 'serveur'
    titre = t('analyse.echecTitre')
    corps = t('analyse.echecServeurCorps')
  } else if (suivi.phase === 'inconnu') {
    echec = 'serveur'
    titre = t('analyse.echecTitre')
    corps = t('analyse.inconnu')
  }

  const refaire = () => {
    if (suite === 'profil') router.replace('/accueil/prise')
    else router.replace('/(onglets)/aujourdhui')
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.hero }}
      contentContainerStyle={[
        styles.contenu,
        { paddingTop: insets.top + espaces.xxl, paddingBottom: insets.bottom + espaces.xl },
      ]}
    >
      <View style={styles.centre}>
        <Bulle taille="moyenne" calme={echec !== null} />
        <Titre niveau="ecran" surFondSombre centre>
          {titre}
        </Titre>
        {corps ? (
          <Text style={[typographie.corps, styles.corps, { color: theme.heroTexteSecondaire }]}>
            {corps}
          </Text>
        ) : null}
      </View>

      {echec === null ? (
        <View style={styles.etapes}>
          {(suivi.phase === 'serveur'
            ? ETAPES.map((cle, index) => ({
                libelle: t(`analyse.${cle}`),
                etat: index < etape ? 'fait' : index === etape ? 'courant' : 'a_venir',
              }))
            : [
                {
                  libelle:
                    suivi.phase === 'telephone' && suivi.entree.etat === 'envoyee'
                      ? t('analyse.envoyee')
                      : t('analyse.envoi'),
                  etat:
                    suivi.phase === 'telephone' && suivi.entree.etat === 'envoyee'
                      ? 'fait'
                      : 'courant',
                },
                { libelle: t('analyse.enCours'), etat: 'a_venir' },
                { libelle: t('analyse.retourIci'), etat: 'a_venir' },
              ]
          ).map((ligne) => (
            <Carte key={ligne.libelle} teinte="sombre" style={styles.etape}>
              <View style={styles.ligne}>
                <View
                  style={[
                    styles.point,
                    { backgroundColor: ligne.etat === 'a_venir' ? theme.heroBordure : theme.voix },
                  ]}
                />
                <Text
                  style={[
                    typographie.corpsFort,
                    {
                      color: ligne.etat === 'a_venir' ? theme.heroTexteSecondaire : theme.heroTexte,
                    },
                  ]}
                >
                  {ligne.libelle}
                </Text>
              </View>
            </Carte>
          ))}
        </View>
      ) : null}

      {echec === 'telephone' ? (
        <Carte teinte="sombre" style={styles.etape}>
          <Text style={[typographie.corpsFort, { color: theme.heroTexte }]}>
            {serie.data && serie.data.courante > 0
              ? t('envoi.echec.serieIntacte', { jours: serie.data.courante })
              : t('envoi.echec.serieIntacteSansJours')}
          </Text>
        </Carte>
      ) : null}

      <View style={styles.actions}>
        {echec === 'telephone' ? (
          <>
            <Bouton libelle={t('analyse.reessayer')} onPress={() => void file.envoyerEnAttente()} />
            <Bouton
              libelle={t('analyse.plusTard')}
              variante="texte"
              surFondSombre
              onPress={quitter}
            />
          </>
        ) : echec === 'serveur' ? (
          <Bouton libelle={t('analyse.refairePrise')} onPress={refaire} />
        ) : (
          <>
            <Text style={[typographie.petit, styles.corps, { color: theme.heroTexteSecondaire }]}>
              {t('analyse.retourIci')}
            </Text>
            <Bouton
              libelle={t('analyse.quitter')}
              variante="secondaire"
              surFondSombre
              onPress={quitter}
            />
          </>
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  contenu: { flexGrow: 1, paddingHorizontal: espaces.xl, gap: espaces.l },
  centre: { alignItems: 'center', gap: espaces.m },
  corps: { textAlign: 'center' },
  etapes: { gap: espaces.s },
  etape: { paddingVertical: espaces.m },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espaces.s },
  point: { width: 10, height: 10, borderRadius: 5 },
  actions: { marginTop: 'auto', gap: espaces.s, paddingTop: espaces.l },
})
