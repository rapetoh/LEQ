import { MesuresSchema } from '@leq/domaine'
import { useLocalSearchParams, useRouter } from 'expo-router'
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
import { file } from '@/services/prises'
import { ecrireProfilLocal } from '@/services/profilLocal'
import { supabase } from '@/services/supabase'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, typographie } from '@/theme/tokens'

// A5 · L'analyse, X2 · L'envoi, X3 · L'analyse a échoué: one screen, several states.
// Bulle says what is really happening; the person may leave and be told when it is ready.

const ETAPES = ['etapeRythme', 'etapeBequilles', 'etapeProfil'] as const

function etapeCourante(statut: string): number {
  if (statut === 'envoyee' || statut === 'en_transcription') return 0
  if (statut === 'en_mesure') return 1
  return 2
}

export default function Analyse() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { marquerAccueilTermine } = useDemarrage()
  const params = useLocalSearchParams<{ id?: string }>()
  const id = typeof params.id === 'string' ? params.id : null
  const suivi = useSuiviPrise(id)
  const [erreurLecture, setErreurLecture] = useState(false)

  useEffect(() => {
    if (suivi.phase !== 'pret' || !id) return
    let actif = true
    void (async () => {
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
  }, [suivi.phase, id, router])

  // The right moment to ask for notifications: the person is about to leave and wants to
  // be told. A refusal changes nothing, the screen polls when it is open.
  const quitter = () => {
    void activerNotifications().finally(() => {
      marquerAccueilTermine()
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

  return (
    <ScrollView
      style={{ backgroundColor: theme.fond }}
      contentContainerStyle={[
        styles.contenu,
        { paddingTop: insets.top + espaces.xxl, paddingBottom: insets.bottom + espaces.xl },
      ]}
    >
      <View style={styles.centre}>
        <Bulle taille="moyenne" calme={echec !== null} />
        <Titre niveau="ecran" centre>
          {titre}
        </Titre>
        {corps ? (
          <Text style={[typographie.corps, styles.corps, { color: theme.texteSecondaire }]}>
            {corps}
          </Text>
        ) : null}
      </View>

      {echec === null && suivi.phase === 'serveur' ? (
        <View style={styles.etapes}>
          {ETAPES.map((cle, index) => (
            <Carte key={cle} teinte={index === etape ? 'voix' : 'carte'} style={styles.etape}>
              <Text
                style={[
                  typographie.corpsFort,
                  { color: index <= etape ? theme.texte : theme.texteTertiaire },
                ]}
              >
                {t(`analyse.${cle}`)}
              </Text>
            </Carte>
          ))}
        </View>
      ) : null}

      <View style={styles.actions}>
        {echec === 'telephone' ? (
          <>
            <Bouton libelle={t('analyse.reessayer')} onPress={() => void file.envoyerEnAttente()} />
            <Bouton libelle={t('analyse.plusTard')} variante="texte" onPress={quitter} />
          </>
        ) : echec === 'serveur' ? (
          <Bouton
            libelle={t('analyse.refairePrise')}
            onPress={() => router.replace('/accueil/prise')}
          />
        ) : (
          <>
            <Text style={[typographie.petit, styles.corps, { color: theme.texteTertiaire }]}>
              {t('analyse.retourIci')}
            </Text>
            <Bouton libelle={t('analyse.quitter')} variante="secondaire" onPress={quitter} />
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
  actions: { marginTop: 'auto', gap: espaces.s, paddingTop: espaces.l },
})
