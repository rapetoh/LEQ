import { useQueryClient } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { AnneauProgression } from '@/components/AnneauProgression'
import { useBarreEtatClaire } from '@/components/BarreEtat'
import { Bulle } from '@/components/Bulle'
import { EcranChargement } from '@/components/EcransEtat'
import { Onde } from '@/components/Onde'
import { Bouton } from '@/components/ui/Bouton'
import { Icone } from '@/components/ui/Icone'
import { Titre } from '@/components/ui/Titre'
import { t } from '@/i18n/fr'
import type { RaisonFinTour } from '@leq/domaine'

import { ClientDebat, invaliderDebats, type MessageSortant } from '@/services/debat'
import { AudioDebat } from '@/services/debatAudio'
import { maintenant } from '@/services/delai'
import { lireEtatMicro } from '@/services/micro'
import { supabase } from '@/services/supabase'
import { compter } from '@/services/usage'
import { FondSombre } from '@/theme/FondSombre'
import { useTheme } from '@/theme/ThemeProvider'
import { couleurs, espaces, polices, rayons, typographie } from '@/theme/tokens'

// E3 · Le face-à-face, and E3b when it is cut.
//
// One rule holds this screen together: **the person always knows whose turn it is, and the
// answer comes from the server**. The floor arrives as `a_toi` and `a_retor` and the screen
// draws that and nothing else. Before this, the transcription provider ended a turn after
// 700 ms of silence and the screen was never told: it kept saying « À toi de parler » to
// someone whose microphone had stopped counting, and Rétor answered half an argument.
//
// So: the wave says the microphone hears you, the countdown says the silence is about to pass
// the floor and one word takes it back, « J'ai fini » passes it now, and while Rétor speaks
// « Reprendre la parole » cuts him off the way a person would.

type Phase = 'connexion' | 'a_toi' | 'reflexion' | 'retor' | 'interrompu' | 'termine'

type Ligne = { numero: number; locuteur: 'utilisateur' | 'retor'; texte: string }

/** Bars of the wave, as the recording screens draw it. */
const NB_BARRES = 26
const SILENCE_PAR_DEFAUT_MS = 2200

function formater(secondes: number): string {
  const s = Math.max(0, Math.round(secondes))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function FaceAFace() {
  const theme = useTheme()
  useBarreEtatClaire()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const clientRequetes = useQueryClient()
  const { debatId = '' } = useLocalSearchParams<{ debatId: string }>()
  const serre = height < 760

  const [phase, setPhase] = useState<Phase>('connexion')
  const [these, setThese] = useState('')
  const [lignes, setLignes] = useState<Ligne[]>([])
  const [partiel, setPartiel] = useState('')
  const [restantes, setRestantes] = useState<number | null>(null)
  const [dureeMax, setDureeMax] = useState(0)
  const [erreur, setErreur] = useState<string | null>(null)
  const [microCoupe, setMicroCoupe] = useState(false)
  const [niveaux, setNiveaux] = useState<number[]>(() => Array<number>(NB_BARRES).fill(-100))
  const [silenceMs, setSilenceMs] = useState(SILENCE_PAR_DEFAUT_MS)
  /** When the server stopped hearing a voice. The countdown is drawn from it. */
  const [silenceDepuis, setSilenceDepuis] = useState<number | null>(null)
  /** What the server said was left of that silence when it announced it. */
  const [silenceRestant, setSilenceRestant] = useState<number | null>(null)
  /** Why the last turn ended, so the panel says what happened instead of « Rétor réfléchit ». */
  const [raisonFin, setRaisonFin] = useState<RaisonFinTour | null>(null)
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
        setDureeMax(message.duree_max_s)
        setRestantes(Math.max(0, message.duree_max_s - message.secondes_parlees))
        setSilenceMs(message.silence_fin_tour_ms || SILENCE_PAR_DEFAUT_MS)
        return
      case 'a_toi':
        setPhase('a_toi')
        setSilenceDepuis(null)
        setRaisonFin(null)
        setPartiel('')
        audio.current.taire()
        audio.current.ecouter(true)
        return
      case 'parole':
        // A word cancels the countdown, a silence starts it, and the server says how long that
        // silence still has. The floor itself moves on `a_retor` and never here, so the person
        // can always take it back by speaking.
        setSilenceRestant(message.restant_ms ?? null)
        setSilenceDepuis(message.actif ? null : maintenant())
        return
      case 'a_retor':
        audio.current.ecouter(false)
        setSilenceDepuis(null)
        setRaisonFin(message.raison)
        setPhase('reflexion')
        return
      case 'transcription':
        setPartiel(message.texte)
        return
      case 'mon_tour':
        setLignes((courantes) => [
          ...courantes,
          { numero: message.numero, locuteur: 'utilisateur', texte: message.texte },
        ])
        setPartiel('')
        return
      case 'temps':
        setRestantes(message.secondes_restantes)
        return
      case 'reponse_texte':
        setLignes((courantes) => [
          ...courantes,
          { numero: message.numero, locuteur: 'retor', texte: message.texte },
        ])
        setPhase('retor')
        return
      case 'reponse_audio':
        if (!message.fin) audio.current.jouer(message.donnees)
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
              // A call or an alarm took the microphone. The turn ends with what was captured,
              // and the screen says it was the microphone and not the person.
              setMicroCoupe(true)
              clientDebat.envoyer({ type: 'fin_tour', raison: 'micro' })
            } else {
              setMicroCoupe(false)
            }
          },
          (db) => {
            if (!vivant) return
            setNiveaux((precedents) => [...precedents.slice(1), db])
          },
        )
      } catch (erreurAudio) {
        // The microphone sentence only when the microphone is the cause. Anything else (the
        // audio session, the recorder, the context) is said as what it is, with the detail,
        // so the person can tell us what failed instead of looking for a switch that is on.
        const etatMicro = await lireEtatMicro().catch(() => 'indetermine' as const)
        const detail = erreurAudio instanceof Error ? erreurAudio.message : String(erreurAudio)
        if (vivant) {
          setErreur(
            etatMicro === 'refuse'
              ? t('debat.microRefuse')
              : `${t('debat.audioIndisponible')}\n${t('prise.detail', { detail })}`,
          )
          setPhase('interrompu')
        }
        console.warn('debat: audio indisponible', erreurAudio)
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
    if (phase !== 'termine') return
    invaliderDebats(clientRequetes)
    compter('debat_termine')
  }, [phase, clientRequetes])

  // The app keeps the microphone in the background (the audio session says so), so leaving the
  // screen for another app would otherwise send the room's conversation to the server. The turn
  // is not ended: it waits, and picks up where it was when the person comes back.
  useEffect(() => {
    const abonnement = AppState.addEventListener('change', (etat) => {
      if (etat === 'active') {
        if (phase !== 'a_toi') return
        // Whatever the countdown showed when the app went away is stale: the server heard no
        // audio while it was gone, so nothing was running.
        setSilenceDepuis(null)
        audio.current.ecouter(true)
        return
      }
      audio.current.ecouter(false)
    })
    return () => abonnement.remove()
  }, [phase])

  const finirMonTour = () => {
    if (phase !== 'a_toi') return
    audio.current.ecouter(false)
    setSilenceDepuis(null)
    setPhase('reflexion')
    client.current?.envoyer({ type: 'fin_tour', raison: 'bouton' })
  }

  const reprendreLaParole = () => {
    if (phase !== 'retor') return
    audio.current.taire()
    client.current?.envoyer({ type: 'reprendre_parole' })
  }

  const terminer = () => {
    Alert.alert(t('debat.terminerTitre'), t('debat.terminerCorps'), [
      { text: t('debat.terminerContinuer'), style: 'cancel' },
      {
        text: t('debat.terminerOui'),
        style: 'destructive',
        onPress: () => {
          audio.current.ecouter(false)
          audio.current.taire()
          client.current?.envoyer({ type: 'terminer' })
        },
      },
    ])
  }

  if (phase === 'connexion') return <EcranChargement />

  if (phase === 'interrompu') {
    return (
      <FondSombre>
        <View
          style={[
            styles.centre,
            { backgroundColor: theme.hero, paddingTop: insets.top, paddingBottom: insets.bottom },
          ]}
        >
          <Bulle taille="moyenne" visage="attend" calme />
          <Titre niveau="ecran" centre>
            {t('debat.interrompuTitre')}
          </Titre>
          <Text
            style={[typographie.corps, styles.texteCentre, { color: theme.heroTexteSecondaire }]}
          >
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
      </FondSombre>
    )
  }

  if (phase === 'termine') {
    return (
      <FondSombre>
        <View
          style={[
            styles.centre,
            { backgroundColor: theme.hero, paddingTop: insets.top, paddingBottom: insets.bottom },
          ]}
        >
          <Bulle taille="moyenne" visage="sourit" calme />
          <Titre niveau="ecran" centre>
            {t('debat.debriefEnCours')}
          </Titre>
          <Text
            style={[typographie.corps, styles.texteCentre, { color: theme.heroTexteSecondaire }]}
          >
            {t('debat.debriefEnCoursDetail')}
          </Text>
          <View style={styles.actionsCentre}>
            <Bouton
              libelle={t('debat.voirDebrief')}
              onPress={() => router.replace(`/face-a-face/${debatId}/debrief`)}
            />
          </View>
        </View>
      </FondSombre>
    )
  }

  const partDuTemps = dureeMax > 0 && restantes !== null ? restantes / dureeMax : 1
  const presqueFini = restantes !== null && restantes <= 30

  return (
    <FondSombre>
      <View style={[styles.ecran, { backgroundColor: theme.hero, paddingTop: insets.top + 6 }]}>
        <View style={styles.entete}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('debat.terminer')}
            onPress={terminer}
            hitSlop={12}
            style={({ pressed }) => [styles.quitter, pressed && styles.presse]}
          >
            <Icone sf="xmark" material="close" taille={17} couleur={theme.heroTexteSecondaire} />
          </Pressable>
          <Text style={[styles.surtitre, { color: theme.voix }]}>{t('debat.titre')}</Text>
          <View
            style={[
              styles.chrono,
              {
                borderColor: presqueFini ? couleurs.orange : theme.heroBordure,
                backgroundColor: presqueFini ? 'rgba(255, 94, 1, 0.16)' : 'transparent',
              },
            ]}
          >
            <AnneauProgression
              progression={partDuTemps}
              diametre={14}
              epaisseur={2.5}
              couleur={presqueFini ? couleurs.orange : couleurs.or}
            />
            <Text
              style={[
                styles.chronoTexte,
                { color: presqueFini ? couleurs.orange : theme.heroTexte },
              ]}
            >
              {restantes === null ? '--:--' : formater(restantes)}
            </Text>
          </View>
        </View>

        <View style={[styles.these, { borderColor: theme.heroBordure }]}>
          <Text style={[styles.theseEtiquette, { color: theme.heroTexteSecondaire }]}>
            {t('debat.theseDeRetor')}
          </Text>
          <Text
            style={[styles.theseTexte, { color: theme.heroTexte }]}
            numberOfLines={serre ? 2 : 3}
          >
            {`« ${these} »`}
          </Text>
        </View>

        {provisoire ? (
          <Text style={[styles.provisoire, { color: couleurs.or }]}>{t('debat.provisoire')}</Text>
        ) : null}

        <ScrollView
          ref={defilement}
          style={styles.fil}
          contentContainerStyle={styles.filContenu}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => defilement.current?.scrollToEnd({ animated: true })}
        >
          {lignes.length === 0 && partiel === '' ? (
            <View style={styles.debut}>
              <Bulle taille="petite" visage="attend" calme />
              <Text style={[typographie.corps, styles.texteCentre, { color: couleurs.encre3 }]}>
                {t('debat.premierMot')}
              </Text>
            </View>
          ) : null}
          {lignes.map((ligne) => (
            <BulleTexte key={`${ligne.locuteur}-${ligne.numero}`} ligne={ligne} />
          ))}
          {partiel !== '' ? (
            <BulleTexte ligne={{ numero: -1, locuteur: 'utilisateur', texte: partiel }} enCours />
          ) : null}
        </ScrollView>

        <PanneauParole
          phase={phase}
          niveaux={niveaux}
          silenceDepuis={silenceDepuis}
          silenceMs={silenceRestant ?? silenceMs}
          microCoupe={microCoupe}
          raisonFin={raisonFin}
          serre={serre}
          onFini={finirMonTour}
          onReprendre={reprendreLaParole}
          bas={insets.bottom + espaces.s}
        />
      </View>
    </FondSombre>
  )
}

/** One turn in the thread: Rétor on the left in his ink, the person on the right in gold. */
function BulleTexte({ ligne, enCours = false }: { ligne: Ligne; enCours?: boolean }) {
  const theme = useTheme()
  const deRetor = ligne.locuteur === 'retor'
  return (
    <View style={[styles.bulleRangee, deRetor ? styles.aGauche : styles.aDroite]}>
      <View
        style={[
          styles.bulle,
          deRetor
            ? { backgroundColor: 'rgba(255, 255, 255, 0.07)', borderColor: theme.heroBordure }
            : {
                backgroundColor: enCours ? 'rgba(255, 189, 89, 0.10)' : 'rgba(255, 189, 89, 0.18)',
                borderColor: enCours ? 'rgba(255, 189, 89, 0.35)' : 'transparent',
              },
          deRetor ? styles.bulleRetor : styles.bulleMoi,
        ]}
      >
        {/* Rétor wears the app's gold, the person their own pale ink: two voices, two marks. */}
        <Text style={[styles.locuteur, { color: deRetor ? couleurs.or : couleurs.encre3 }]}>
          {deRetor ? t('debat.retor') : t('debat.toi')}
        </Text>
        <Text
          style={[
            typographie.corps,
            { color: couleurs.blanc },
            enCours && { color: couleurs.encre3 },
          ]}
        >
          {ligne.texte}
        </Text>
      </View>
    </View>
  )
}

/**
 * The floor, drawn. Whose turn it is, how loud the microphone hears the person, how much of the
 * silence is left before it passes, and the one action that fits the moment.
 */
function PanneauParole({
  phase,
  niveaux,
  silenceDepuis,
  silenceMs,
  microCoupe,
  raisonFin,
  serre,
  onFini,
  onReprendre,
  bas,
}: {
  phase: Phase
  niveaux: number[]
  silenceDepuis: number | null
  silenceMs: number
  microCoupe: boolean
  raisonFin: RaisonFinTour | null
  serre: boolean
  onFini: () => void
  onReprendre: () => void
  bas: number
}) {
  const theme = useTheme()
  const compte = phase === 'a_toi' && silenceDepuis !== null
  const instant = useHorloge(compte)
  const reste = compte && silenceDepuis ? Math.max(0, silenceMs - (instant - silenceDepuis)) : null
  const partSilence = reste !== null && silenceMs > 0 ? 1 - reste / silenceMs : 0

  return (
    <View style={[styles.panneau, { paddingBottom: bas, borderTopColor: theme.heroBordure }]}>
      {phase === 'a_toi' ? (
        <>
          <View style={styles.etat}>
            <View style={[styles.point, { backgroundColor: couleurs.or }]} />
            <Text style={[styles.etatTexte, { color: couleurs.or }]}>
              {microCoupe
                ? t('debat.microCoupe')
                : reste !== null
                  ? t('debat.retorVaRepondre')
                  : t('debat.jeTEcoute')}
            </Text>
          </View>
          <Onde niveaux={niveaux} hauteur={serre ? 38 : 52} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('debat.jaiFini')}
            onPress={onFini}
            style={({ pressed }) => [
              styles.bouton,
              { backgroundColor: couleurs.or },
              pressed && styles.presse,
            ]}
          >
            {/* The silence fills the button: the floor is seen leaving before it leaves. */}
            <View
              style={[styles.remplissage, { width: `${Math.round(partSilence * 100)}%` }]}
              pointerEvents="none"
            />
            <Text style={[styles.boutonTexte, { color: couleurs.bleuNuit }]}>
              {t('debat.jaiFini')}
            </Text>
          </Pressable>
        </>
      ) : phase === 'reflexion' ? (
        <>
          <View style={styles.etat}>
            <Bulle taille="minuscule" visage="attend" calme />
            <Text style={[styles.etatTexte, { color: theme.heroTexteSecondaire }]}>
              {raisonFin === 'micro'
                ? t('debat.microCoupeTour')
                : raisonFin === 'plafond'
                  ? t('debat.tempsEpuise')
                  : t('debat.retorReflechit')}
            </Text>
          </View>
          <PointsQuiRespirent />
          {/* The same control as when he speaks, not yet available: cutting off a sentence that
              does not exist yet would only lose the answer. No second line saying what the line
              above already says. */}
          <View style={[styles.bouton, styles.boutonMuet, { borderColor: theme.heroBordure }]}>
            <Icone
              sf="mic.slash.fill"
              material="mic-off"
              taille={16}
              couleur={theme.heroTexteSecondaire}
            />
            <Text style={[styles.boutonTexte, { color: theme.heroTexteSecondaire }]}>
              {t('debat.reprendreParole')}
            </Text>
          </View>
        </>
      ) : (
        <>
          <View style={styles.etat}>
            <Bulle taille="minuscule" visage="parle" />
            <Text style={[styles.etatTexte, { color: couleurs.or }]}>{t('debat.retorParle')}</Text>
          </View>
          <PointsQuiRespirent parle />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('debat.reprendreParole')}
            onPress={onReprendre}
            style={({ pressed }) => [
              styles.bouton,
              styles.boutonBordure,
              { borderColor: couleurs.or },
              pressed && styles.presse,
            ]}
          >
            <Icone sf="mic.fill" material="mic" taille={16} couleur={couleurs.or} />
            <Text style={[styles.boutonTexte, { color: couleurs.or }]}>
              {t('debat.reprendreParole')}
            </Text>
          </Pressable>
        </>
      )}
    </View>
  )
}

/** Three bars breathing while Rétor thinks or speaks: the wait has a pulse, not a spinner. */
function PointsQuiRespirent({ parle = false }: { parle?: boolean }) {
  const instant = useHorloge(true)
  const phase = Math.floor(instant / (parle ? 140 : 260)) % 3
  return (
    <View style={styles.respire}>
      {[0, 1, 2].map((index) => (
        <View
          key={index}
          style={[
            styles.barre,
            {
              height: index === phase ? 22 : 10,
              backgroundColor: index === phase ? couleurs.or : 'rgba(255, 189, 89, 0.35)',
            },
          ]}
        />
      ))}
    </View>
  )
}

/** A clock that only ticks while something is moving on screen. */
function useHorloge(actif: boolean): number {
  const [instant, setInstant] = useState(() => maintenant())
  useEffect(() => {
    if (!actif) return
    const battement = setInterval(() => setInstant(maintenant()), 80)
    return () => clearInterval(battement)
  }, [actif])
  return instant
}

const styles = StyleSheet.create({
  ecran: { flex: 1 },
  entete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaces.s,
    paddingHorizontal: espaces.l,
    paddingBottom: espaces.xs,
  },
  quitter: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  surtitre: {
    flex: 1,
    fontFamily: polices.extraBold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  chrono: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: rayons.pilule,
    borderWidth: 1,
  },
  chronoTexte: { fontFamily: polices.bold, fontSize: 13, lineHeight: 17 },
  these: {
    marginHorizontal: espaces.l,
    marginTop: espaces.xs,
    paddingHorizontal: espaces.m,
    paddingVertical: espaces.s,
    borderRadius: rayons.l,
    borderWidth: 1,
    gap: 2,
  },
  theseEtiquette: {
    fontFamily: polices.bold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  theseTexte: { fontFamily: polices.bold, fontSize: 15, lineHeight: 21 },
  provisoire: {
    paddingHorizontal: espaces.l,
    paddingTop: espaces.xs,
    fontFamily: polices.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  fil: { flex: 1, marginTop: espaces.s },
  // The exchange sits on the panel, the way a conversation does, instead of hanging from the
  // thesis with a hole under it.
  filContenu: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: espaces.l,
    paddingBottom: espaces.m,
    gap: espaces.xs,
  },
  debut: { alignItems: 'center', gap: espaces.s, paddingVertical: espaces.xl },
  bulleRangee: { flexDirection: 'row' },
  aGauche: { justifyContent: 'flex-start' },
  aDroite: { justifyContent: 'flex-end' },
  bulle: {
    maxWidth: '88%',
    paddingHorizontal: espaces.m,
    paddingVertical: espaces.s,
    borderWidth: 1,
    gap: 3,
  },
  bulleRetor: {
    borderTopLeftRadius: 6,
    borderTopRightRadius: rayons.l,
    borderBottomLeftRadius: rayons.l,
    borderBottomRightRadius: rayons.l,
  },
  bulleMoi: {
    borderTopLeftRadius: rayons.l,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: rayons.l,
    borderBottomRightRadius: rayons.l,
  },
  locuteur: {
    fontFamily: polices.extraBold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  panneau: {
    paddingHorizontal: espaces.l,
    paddingTop: espaces.s,
    gap: espaces.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  etat: { flexDirection: 'row', alignItems: 'center', gap: espaces.xs, minHeight: 26 },
  point: { width: 8, height: 8, borderRadius: 4 },
  etatTexte: { fontFamily: polices.bold, fontSize: 14, lineHeight: 19, flex: 1 },
  respire: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 26 },
  barre: { width: 6, borderRadius: 3 },
  bouton: {
    minHeight: 54,
    borderRadius: rayons.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: espaces.xs,
    overflow: 'hidden',
  },
  boutonBordure: { borderWidth: 1.5, backgroundColor: 'transparent' },
  boutonMuet: { borderWidth: 1, backgroundColor: 'transparent' },
  boutonTexte: { fontFamily: polices.extraBold, fontSize: 16, lineHeight: 21 },
  remplissage: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  presse: { opacity: 0.85 },
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
