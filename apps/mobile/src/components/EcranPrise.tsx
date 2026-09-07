import type { AppuiPlan, TypeTentative } from '@leq/domaine'
import { randomUUID } from 'expo-crypto'
import { File } from 'expo-file-system'
import { useNetworkState } from 'expo-network'
import { useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Bulle } from '@/components/Bulle'
import { Onde } from '@/components/Onde'
import { Bouton } from '@/components/ui/Bouton'
import { Carte } from '@/components/ui/Carte'
import { Titre } from '@/components/ui/Titre'
import { t } from '@/i18n/fr'
import { enregistrement } from '@/services/enregistrement'
import { demanderMicro } from '@/services/micro'
import { file, horodatageLocal } from '@/services/prises'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, typographie } from '@/theme/tokens'

// The recording screen shared by A4 (diagnostic) and B4 (a step). The room goes quiet:
// Bulle listens without moving, nothing judges. X4 is the offline banner. The text format
// shows its text first (the timer starts after the reading), the long format runs a
// preparation countdown with the three supports before the take.

const NB_BARRES = 40
type Phase = 'lecture' | 'preparation' | 'pret' | 'en_cours' | 'terminee' | 'erreur'

export function formaterDuree(secondes: number): string {
  const s = Math.max(0, Math.floor(secondes))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export type ProprietesPrise = {
  type: TypeTentative
  etapeId?: string
  surtitre: string
  titre: string
  consigne: string
  /** Shown while recording, under Bulle. */
  encouragement?: string
  dureeMin: number
  dureeMax: number
  texteALire?: string | null
  preparationS?: number | null
  plan?: readonly AppuiPlan[]
  /** Called once the take is in the queue (sending starts right away). */
  onTerminee: (tentativeId: string) => void
  onAnnuler: () => void
}

export function EcranPrise(props: ProprietesPrise) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const reseau = useNetworkState()
  const { type, etapeId, dureeMin, dureeMax, onTerminee, onAnnuler } = props

  const phaseInitiale: Phase = props.texteALire
    ? 'lecture'
    : props.preparationS
      ? 'preparation'
      : 'pret'
  const [phase, setPhase] = useState<Phase>(phaseInitiale)
  const [secondes, setSecondes] = useState(0)
  const [preparationRestante, setPreparationRestante] = useState(props.preparationS ?? 0)
  const [niveaux, setNiveaux] = useState<number[]>(() => Array<number>(NB_BARRES).fill(-100))
  const [message, setMessage] = useState<string | null>(null)
  const idRef = useRef<string | null>(null)
  const demarrageRef = useRef(false)
  const [demarrageEnCours, setDemarrageEnCours] = useState(false)
  const minuteur = useRef<ReturnType<typeof setInterval> | null>(null)
  const maxRef = useRef(dureeMax)
  useEffect(() => {
    maxRef.current = dureeMax
  }, [dureeMax])

  const horsLigne = reseau.isConnected === false

  const abandonner = async () => {
    // The recorder hands back the partial file: it goes at once, the voice is never kept.
    const chemin = await enregistrement.annuler()
    if (chemin) {
      try {
        const fichier = new File(chemin)
        if (fichier.exists) fichier.delete()
      } catch (erreur) {
        console.warn('prise: fichier partiel non supprimé', erreur)
      }
    }
    if (idRef.current) {
      await file.annuler(idRef.current).catch(() => undefined)
      idRef.current = null
    }
    if (minuteur.current) clearInterval(minuteur.current)
  }

  useEffect(() => {
    return () => {
      if (minuteur.current) clearInterval(minuteur.current)
      if (enregistrement.estEnCours()) void abandonner()
    }
  }, [])

  // Preparation countdown of the long format.
  useEffect(() => {
    if (phase !== 'preparation') return
    const compteur = setInterval(() => {
      setPreparationRestante((restante) => {
        if (restante <= 1) {
          clearInterval(compteur)
          setPhase('pret')
          return 0
        }
        return restante - 1
      })
    }, 1000)
    return () => clearInterval(compteur)
  }, [phase])

  const terminer = async () => {
    const id = idRef.current
    if (!id || !enregistrement.estEnCours()) return
    if (enregistrement.duree() < dureeMin) {
      setMessage(t('prise.tropCourte', { min: dureeMin }))
      return
    }
    if (minuteur.current) clearInterval(minuteur.current)
    try {
      const prise = await enregistrement.arreter()
      await file.terminer(id, prise)
      setPhase('terminee')
      void file.envoyerEnAttente()
      onTerminee(id)
    } catch (erreur) {
      console.warn('prise: arrêt impossible', erreur)
      await abandonner()
      setPhase('erreur')
      setMessage(t('prise.erreur'))
    }
  }

  const demarrer = async () => {
    // One start at a time: a double tap must not open two recordings.
    if (demarrageRef.current || enregistrement.estEnCours()) return
    demarrageRef.current = true
    setDemarrageEnCours(true)
    setMessage(null)
    if ((await demanderMicro()) !== 'accorde') {
      setMessage(t('prise.micRefuse'))
      demarrageRef.current = false
      setDemarrageEnCours(false)
      return
    }
    const id = randomUUID()
    idRef.current = id
    try {
      await file.commencer({ id, type, etape_id: etapeId ?? null, ...horodatageLocal() })
      await enregistrement.demarrer(
        id,
        (dbfs) => setNiveaux((courants) => [...courants.slice(1), dbfs]),
        () => {
          void abandonner().then(() => {
            setPhase('erreur')
            setMessage(t('prise.interrompue'))
          })
        },
      )
      setSecondes(0)
      setPhase('en_cours')
      minuteur.current = setInterval(() => {
        const duree = enregistrement.duree()
        setSecondes(duree)
        if (duree >= maxRef.current) void terminer()
      }, 250)
    } catch (erreur) {
      console.warn('prise: démarrage impossible', erreur)
      await abandonner()
      setPhase('erreur')
      setMessage(t('prise.erreur'))
    } finally {
      demarrageRef.current = false
      setDemarrageEnCours(false)
    }
  }

  const refaire = async () => {
    await abandonner()
    setNiveaux(Array<number>(NB_BARRES).fill(-100))
    setSecondes(0)
    setPhase('pret')
    setMessage(null)
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.hero }}
      contentContainerStyle={[
        styles.contenu,
        { paddingTop: insets.top + espaces.xl, paddingBottom: insets.bottom + espaces.xl },
      ]}
    >
      {horsLigne ? (
        <Carte teinte="sombre" style={styles.bandeau}>
          <Text style={[typographie.etiquette, { color: theme.heroTexte }]}>
            {t('prise.horsLigne')}
          </Text>
          <Text style={[typographie.petit, { color: theme.heroTexteSecondaire }]}>
            {t('prise.horsLigneDetail')}
          </Text>
        </Carte>
      ) : null}

      <Text style={[typographie.etiquette, { color: theme.heroTexteSecondaire }]}>
        {props.surtitre}
      </Text>
      <Titre niveau="ecran" surFondSombre>
        {props.titre}
      </Titre>
      {props.consigne ? (
        <Text style={[typographie.corps, { color: theme.heroTexteSecondaire }]}>
          {props.consigne}
        </Text>
      ) : null}

      {phase === 'lecture' && props.texteALire ? (
        <Carte teinte="sombre" style={styles.texte}>
          <Text style={[typographie.etiquette, { color: theme.heroTexteSecondaire }]}>
            {t('defi.texteChoisi')}
          </Text>
          <Text style={[typographie.titreCarte, { color: theme.heroTexte }]}>
            « {props.texteALire} »
          </Text>
          <Text style={[typographie.petit, { color: theme.heroTexteSecondaire }]}>
            {t('defi.minuterieApresLecture')}
          </Text>
        </Carte>
      ) : null}

      {phase === 'preparation' ? (
        <Carte teinte="sombre" style={styles.texte}>
          <Text style={[typographie.chiffre, { color: theme.heroTexte }]}>
            {formaterDuree(preparationRestante)}
          </Text>
          {(props.plan ?? []).map((appui, index) => (
            <View key={appui.titre} style={styles.appui}>
              <Text style={[typographie.corpsFort, { color: theme.heroTexte }]}>
                {index + 1}. {appui.titre}
              </Text>
              {appui.detail ? (
                <Text style={[typographie.petit, { color: theme.heroTexteSecondaire }]}>
                  {appui.detail}
                </Text>
              ) : null}
            </View>
          ))}
        </Carte>
      ) : null}

      {phase !== 'lecture' && phase !== 'preparation' ? (
        <View style={styles.centre}>
          <Bulle taille="petite" calme={phase === 'en_cours'} />
          <Text style={[typographie.petit, { color: theme.heroTexteSecondaire }]}>
            {phase === 'en_cours'
              ? (props.encouragement ?? t('prise.ecouteCalme'))
              : t('prise.ecoute')}
          </Text>
          <Text style={[typographie.chiffre, { color: theme.heroTexte }]}>
            {formaterDuree(secondes)}
          </Text>
          <Text style={[typographie.petit, { color: theme.heroTexteSecondaire }]}>
            {t('prise.plage', { min: formaterDuree(dureeMin), max: formaterDuree(dureeMax) })}
          </Text>
          <Onde niveaux={niveaux} />
          {phase === 'en_cours' && props.plan && props.plan.length > 0 ? (
            <View style={styles.appuisPrise}>
              {props.plan.map((appui, index) => (
                <Text
                  key={appui.titre}
                  style={[typographie.petit, { color: theme.heroTexteSecondaire }]}
                >
                  {index + 1}. {appui.titre}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {message ? (
        <Text style={[typographie.corps, styles.message, { color: theme.heroTexteSecondaire }]}>
          {message}
        </Text>
      ) : null}

      <View style={styles.actions}>
        {phase === 'lecture' ? (
          <Bouton
            libelle={t('defi.lireEtParler')}
            onPress={() => setPhase(props.preparationS ? 'preparation' : 'pret')}
          />
        ) : null}
        {phase === 'preparation' ? (
          <Bouton
            libelle={t('prise.demarrer')}
            variante="secondaire"
            onPress={() => setPhase('pret')}
          />
        ) : null}
        {phase === 'pret' || phase === 'erreur' ? (
          <Bouton
            libelle={t('prise.demarrer')}
            chargement={demarrageEnCours}
            onPress={() => void demarrer()}
          />
        ) : null}
        {phase === 'en_cours' ? (
          <>
            <Bouton libelle={t('prise.terminer')} onPress={() => void terminer()} />
            <Bouton
              libelle={t('prise.refaire')}
              variante="secondaire"
              onPress={() => void refaire()}
            />
          </>
        ) : null}
        <Bouton
          libelle={t('prise.annuler')}
          variante="texte"
          surFondSombre
          onPress={() => {
            void abandonner().then(onAnnuler)
          }}
        />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  contenu: { flexGrow: 1, paddingHorizontal: espaces.xl, gap: espaces.m },
  bandeau: { gap: espaces.xxs },
  texte: { gap: espaces.s },
  appui: { gap: 2 },
  appuisPrise: { alignSelf: 'stretch', gap: espaces.xxs, paddingTop: espaces.s },
  centre: { alignItems: 'center', gap: espaces.s, marginTop: espaces.l },
  message: { textAlign: 'center' },
  actions: { marginTop: 'auto', gap: espaces.s, paddingTop: espaces.l },
})
