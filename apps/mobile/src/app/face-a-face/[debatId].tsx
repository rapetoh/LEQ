import { useQueryClient } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Bulle } from '@/components/Bulle'
import { EcranChargement } from '@/components/EcransEtat'
import { Bouton } from '@/components/ui/Bouton'
import { Carte } from '@/components/ui/Carte'
import { Titre } from '@/components/ui/Titre'
import { t } from '@/i18n/fr'
import { AudioDebat } from '@/services/debatAudio'
import { ClientDebat, invaliderDebats, type MessageSortant } from '@/services/debat'
import { supabase } from '@/services/supabase'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, typographie } from '@/theme/tokens'

// E3 · Le face-à-face, and E3b when it is cut. Half duplex: while Rétor speaks the microphone
// keeps running but nothing leaves the phone (ADR-007). The answer appears as text the moment
// it exists, before the voice that says it, because the enemy of this screen is the wait.

type Phase = 'connexion' | 'ecoute' | 'reflexion' | 'retor' | 'interrompu' | 'termine'

type Ligne = { numero: number; locuteur: 'utilisateur' | 'retor'; texte: string }

function formater(secondes: number): string {
  const s = Math.max(0, Math.round(secondes))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function FaceAFace() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const clientRequetes = useQueryClient()
  const { debatId = '' } = useLocalSearchParams<{ debatId: string }>()

  const [phase, setPhase] = useState<Phase>('connexion')
  const [these, setThese] = useState('')
  const [lignes, setLignes] = useState<Ligne[]>([])
  const [partiel, setPartiel] = useState('')
  const [restantes, setRestantes] = useState<number | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [microCoupe, setMicroCoupe] = useState(false)
  // The server runs on stubs until the providers are wired. A stubbed transcript reads exactly
  // like a broken one, so the screen says which it is.
  const [provisoire, setProvisoire] = useState(false)

  const audio = useRef(new AudioDebat())
  const client = useRef<ClientDebat | null>(null)
  const defilement = useRef<ScrollView | null>(null)

  const surMessage = useCallback((message: MessageSortant) => {
    switch (message.type) {
      case 'pret':
        setProvisoire(message.provisoire)
        setThese(message.these)
        setLignes(message.tours)
        setRestantes(Math.max(0, message.duree_max_s - message.secondes_parlees))
        setPhase('ecoute')
        audio.current.ecouter(true)
        return
      case 'transcription':
        setPartiel(message.texte)
        return
      case 'temps':
        setRestantes(message.secondes_restantes)
        setPartiel('')
        return
      case 'reponse_texte':
        setLignes((courantes) => [
          ...courantes,
          { numero: message.numero, locuteur: 'retor', texte: message.texte },
        ])
        setPhase('retor')
        return
      case 'reponse_audio':
        if (message.fin) {
          setPhase('ecoute')
          audio.current.ecouter(true)
        } else {
          audio.current.jouer(message.donnees)
        }
        return
      case 'termine':
        setPhase('termine')
        return
      case 'interrompu':
        setPhase('interrompu')
        return
      case 'erreur':
        setErreur(message.message)
        setPhase('interrompu')
        return
    }
  }, [])

  useEffect(() => {
    const sonore = audio.current
    let vivant = true
    const connecter = async () => {
      const { data } = await supabase.auth.getSession()
      const jeton = data.session?.access_token
      if (!jeton || !vivant) return
      const clientDebat = new ClientDebat(surMessage, (etat) => {
        if (etat === 'fermee' && vivant) {
          setPhase((courante) => (courante === 'termine' ? courante : 'interrompu'))
        }
      })
      client.current = clientDebat
      try {
        await sonore.demarrer(
          (donnees) => clientDebat.envoyer({ type: 'audio', donnees }),
          (etat) => {
            if (!vivant) return
            if (etat === 'coupe') {
              // A call or an alarm took the microphone. Say so, and end the turn with what was
              // captured, rather than letting the person argue into a dead microphone.
              setMicroCoupe(true)
              clientDebat.envoyer({ type: 'fin_tour' })
            } else {
              setMicroCoupe(false)
            }
          },
        )
      } catch (erreurAudio) {
        if (vivant) {
          setErreur(t('debat.microRefuse'))
          setPhase('interrompu')
        }
        console.warn('debat: micro indisponible', erreurAudio)
        return
      }
      // The screen may have been left while the microphone was opening: hand it all back.
      if (!vivant) {
        clientDebat.fermer()
        void sonore.arreter()
        return
      }
      sonore.ecouter(false)
      clientDebat.ouvrir(jeton, debatId, 0)
    }
    void connecter()
    return () => {
      vivant = false
      client.current?.fermer()
      client.current = null
      void sonore.arreter()
    }
  }, [debatId, surMessage])

  useEffect(() => {
    if (phase === 'termine') invaliderDebats(clientRequetes)
  }, [phase, clientRequetes])

  // The app keeps the microphone in the background (the audio session says so), so leaving the
  // screen for another app would otherwise keep sending the room's conversation to the server
  // and writing it into the transcript.
  useEffect(() => {
    const abonnement = AppState.addEventListener('change', (etat) => {
      if (etat === 'active') return
      audio.current.ecouter(false)
      if (phase === 'ecoute') {
        setPhase('reflexion')
        client.current?.envoyer({ type: 'fin_tour' })
      }
    })
    return () => abonnement.remove()
  }, [phase])

  const finirMonTour = () => {
    if (phase !== 'ecoute') return
    audio.current.ecouter(false)
    setPhase('reflexion')
    client.current?.envoyer({ type: 'fin_tour' })
  }

  const terminer = () => {
    audio.current.ecouter(false)
    audio.current.taire()
    client.current?.envoyer({ type: 'terminer' })
  }

  if (phase === 'connexion') return <EcranChargement />

  if (phase === 'interrompu') {
    return (
      <View
        style={[
          styles.centre,
          { backgroundColor: theme.hero, paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        <Bulle taille="moyenne" visage="attend" calme />
        <Titre niveau="ecran" surFondSombre centre>
          {t('debat.interrompuTitre')}
        </Titre>
        <Text style={[typographie.corps, styles.texteCentre, { color: theme.heroTexteSecondaire }]}>
          {erreur ?? t('debat.interrompuCorps')}
        </Text>
        <View style={styles.actionsCentre}>
          <Bouton
            libelle={t('debat.reprendre')}
            onPress={() => router.replace(`/face-a-face/${debatId}`)}
          />
          <Bouton
            libelle={t('debat.reprendreAutre')}
            variante="secondaire"
            onPress={() => router.replace('/face-a-face')}
          />
        </View>
      </View>
    )
  }

  if (phase === 'termine') {
    return (
      <View
        style={[
          styles.centre,
          { backgroundColor: theme.hero, paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        <Bulle taille="moyenne" visage="sourit" calme />
        <Titre niveau="ecran" surFondSombre centre>
          {t('debat.debriefEnCours')}
        </Titre>
        <Text style={[typographie.corps, styles.texteCentre, { color: theme.heroTexteSecondaire }]}>
          {t('debat.debriefEnCoursDetail')}
        </Text>
        <View style={styles.actionsCentre}>
          <Bouton
            libelle={t('debat.voirDebrief')}
            onPress={() => router.replace(`/face-a-face/${debatId}/debrief`)}
          />
        </View>
      </View>
    )
  }

  return (
    <View
      style={[styles.ecran, { backgroundColor: theme.hero, paddingTop: insets.top + espaces.m }]}
    >
      <View style={styles.entete}>
        <Text style={[typographie.etiquette, styles.majuscules, { color: theme.voix }]}>
          {t('debat.titre')}
        </Text>
        <Text style={[typographie.corpsFort, { color: theme.heroTexte }]}>{these}</Text>
        {restantes !== null ? (
          <Text style={[typographie.petit, { color: theme.heroTexteSecondaire }]}>
            {t('debat.tempsRestant', { temps: formater(restantes) })}
          </Text>
        ) : null}
      </View>

      {provisoire ? (
        <Carte teinte="sombre" style={styles.provisoire}>
          <Text style={[typographie.petit, { color: theme.heroTexteSecondaire }]}>
            {t('debat.provisoire')}
          </Text>
        </Carte>
      ) : null}

      <ScrollView
        ref={defilement}
        style={styles.fil}
        contentContainerStyle={styles.filContenu}
        onContentSizeChange={() => defilement.current?.scrollToEnd({ animated: true })}
      >
        {lignes.map((ligne) => (
          <Carte
            key={ligne.numero}
            teinte={ligne.locuteur === 'retor' ? 'sombre' : 'voix'}
            style={styles.bulleTexte}
          >
            <Text style={[typographie.etiquette, { color: theme.texteTertiaire }]}>
              {ligne.locuteur === 'retor' ? t('debat.retor') : t('debat.toi')}
            </Text>
            <Text
              style={[
                typographie.corps,
                { color: ligne.locuteur === 'retor' ? theme.heroTexte : theme.texte },
              ]}
            >
              {ligne.texte}
            </Text>
          </Carte>
        ))}
        {partiel !== '' ? (
          <Text style={[typographie.corps, styles.partiel, { color: theme.heroTexteSecondaire }]}>
            {partiel}
          </Text>
        ) : null}
      </ScrollView>

      <View style={[styles.pied, { paddingBottom: insets.bottom + espaces.m }]}>
        <Text style={[typographie.corpsFort, styles.texteCentre, { color: theme.voix }]}>
          {microCoupe
            ? t('debat.microCoupe')
            : phase === 'ecoute'
              ? t('debat.aToiDeParler')
              : phase === 'reflexion'
                ? t('debat.retorRepond')
                : t('debat.retorParle')}
        </Text>
        <Bouton
          libelle={t('debat.jaiFini')}
          desactive={phase !== 'ecoute'}
          onPress={finirMonTour}
        />
        <Bouton libelle={t('debat.terminer')} variante="texte" onPress={terminer} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  ecran: { flex: 1 },
  entete: { paddingHorizontal: espaces.xl, gap: espaces.xxs, paddingBottom: espaces.s },
  majuscules: { textTransform: 'uppercase' },
  fil: { flex: 1 },
  filContenu: { paddingHorizontal: espaces.xl, paddingBottom: espaces.l, gap: espaces.s },
  provisoire: { marginHorizontal: espaces.xl, marginBottom: espaces.s },
  bulleTexte: { gap: espaces.xxs },
  partiel: { fontStyle: 'italic' },
  pied: { paddingHorizontal: espaces.xl, paddingTop: espaces.s, gap: espaces.xs },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: espaces.m,
    padding: espaces.xl,
  },
  texteCentre: { textAlign: 'center' },
  actionsCentre: { alignSelf: 'stretch', gap: espaces.xs, marginTop: espaces.m },
})
