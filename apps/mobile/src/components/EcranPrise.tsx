import type { AppuiPlan, TypeTentative } from '@leq/domaine'
import { randomUUID } from 'expo-crypto'
import { File } from 'expo-file-system'
import { useNetworkState } from 'expo-network'
import { useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { AnneauProgression } from '@/components/AnneauProgression'
import { Bulle } from '@/components/Bulle'
import { Onde } from '@/components/Onde'
import { Bouton } from '@/components/ui/Bouton'
import { Carte } from '@/components/ui/Carte'
import { t } from '@/i18n/fr'
import { enregistrement } from '@/services/enregistrement'
import { demanderMicro } from '@/services/micro'
import { file, horodatageLocal } from '@/services/prises'
import { compter } from '@/services/usage'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, polices, rayons, typographie } from '@/theme/tokens'

// The recording screen shared by A4 (diagnostic) and B4 (a step, an Arena or duel take).
// The room goes quiet: Bulle listens without moving, nothing judges. X4 is the offline
// banner. The text format shows its text first (the timer starts after the reading), the
// long format runs a preparation countdown with the three supports before the take.
//
// Two drawings, as the mockup has two: the diagnostic keeps its consigne as the title, the
// listening line under it and the timer inside a ring that fills from zero to the maximum;
// every other take shows its title small at the top, the timer alone at 56 points, the
// waveform across the screen over a faint gold baseline, and the listening line under it.

const NB_BARRES = 40
type Phase = 'lecture' | 'preparation' | 'pret' | 'en_cours' | 'terminee' | 'erreur'

export function formaterDuree(secondes: number): string {
  const s = Math.max(0, Math.floor(secondes))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export type ProprietesPrise = {
  type: TypeTentative
  etapeId?: string
  /** Set when the take answers a duel (Phase 7). */
  duelId?: string
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
  const [detail, setDetail] = useState<string | null>(null)
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
      compter('prise_enregistree', { type, duree_s: Math.round(prise.duree_s) })
      void file.envoyerEnAttente()
      onTerminee(id)
    } catch (erreur) {
      console.warn('prise: arrêt impossible', erreur)
      setDetail(erreur instanceof Error ? erreur.message : String(erreur))
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
    setDetail(null)
    if ((await demanderMicro()) !== 'accorde') {
      setMessage(t('prise.micRefuse'))
      demarrageRef.current = false
      setDemarrageEnCours(false)
      return
    }
    const id = randomUUID()
    idRef.current = id
    try {
      await file.commencer({
        id,
        type,
        etape_id: etapeId ?? null,
        duel_id: props.duelId ?? null,
        ...horodatageLocal(),
      })
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
      setDetail(erreur instanceof Error ? erreur.message : String(erreur))
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

  const anneau = type === 'diagnostic'
  const enregistre = phase !== 'lecture' && phase !== 'preparation'
  const ligneEcoute = (
    <View style={styles.ecoute}>
      <Bulle taille="minuscule" calme={phase === 'en_cours'} />
      <Text style={[styles.ecouteTexte, { color: theme.heroTexteSecondaire }]}>
        {phase === 'en_cours' ? (props.encouragement ?? t('prise.ecouteCalme')) : t('prise.ecoute')}
      </Text>
    </View>
  )

  return (
    <ScrollView
      style={{ backgroundColor: theme.hero }}
      contentContainerStyle={[
        styles.contenu,
        { paddingTop: insets.top + espaces.xl, paddingBottom: insets.bottom + espaces.l },
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

      {anneau ? (
        <View style={styles.tete}>
          <Text style={[styles.surtitre, { color: theme.heroTexteSecondaire }]}>
            {props.surtitre}
          </Text>
          <Text
            style={[styles.titreDiagnostic, { color: theme.heroTexte }]}
            accessibilityRole="header"
          >
            {props.titre}
          </Text>
          {props.consigne ? (
            <Text style={[typographie.corps, { color: theme.heroTexteSecondaire }]}>
              {props.consigne}
            </Text>
          ) : null}
          {enregistre ? ligneEcoute : null}
        </View>
      ) : (
        <View style={styles.teteCentree}>
          <Text
            style={[styles.titrePetit, { color: theme.heroTexteSecondaire }]}
            accessibilityRole="header"
          >
            {props.titre}
          </Text>
          {props.consigne ? (
            <Text style={[styles.consignePetite, { color: theme.heroTexteSecondaire }]}>
              {props.consigne}
            </Text>
          ) : null}
        </View>
      )}

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
          <Text style={[styles.chronoGrand, { color: theme.heroTexte }]}>
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

      {enregistre && anneau ? (
        <View style={styles.centre}>
          <AnneauProgression
            progression={dureeMax > 0 ? secondes / dureeMax : 0}
            diametre={190}
            piste={theme.heroCarte}
          >
            <Text style={[styles.chronoAnneau, { color: theme.heroTexte }]}>
              {formaterDuree(secondes)}
            </Text>
            <Text style={[styles.plage, { color: theme.heroTexteSecondaire }]}>
              {t('prise.plage', { min: formaterDuree(dureeMin), max: formaterDuree(dureeMax) })}
            </Text>
          </AnneauProgression>
          <View style={styles.ondeEtroite}>
            <Onde niveaux={niveaux} hauteur={44} />
          </View>
        </View>
      ) : null}

      {enregistre && !anneau ? (
        <View style={styles.centre}>
          <View style={styles.chronoBloc}>
            <Text style={[styles.chronoGrand, { color: theme.heroTexte }]}>
              {formaterDuree(secondes)}
            </Text>
            <Text style={[styles.plage, { color: theme.heroTexteSecondaire }]}>
              {t('prise.plage', { min: formaterDuree(dureeMin), max: formaterDuree(dureeMax) })}
            </Text>
          </View>
          <Onde niveaux={niveaux} hauteur={132} ligneDeBase />
          {ligneEcoute}
        </View>
      ) : null}

      {enregistre && phase === 'en_cours' && props.plan && props.plan.length > 0 ? (
        <View style={styles.appuisPrise}>
          {props.plan.map((appui, index) => (
            <Text
              key={appui.titre}
              style={[styles.appuiPrise, { color: theme.heroTexteSecondaire }]}
            >
              {index + 1}. {appui.titre}
            </Text>
          ))}
        </View>
      ) : null}

      {message ? (
        <Text style={[typographie.corps, styles.message, { color: theme.heroTexteSecondaire }]}>
          {message}
        </Text>
      ) : null}
      {detail ? (
        <Text style={[typographie.petit, styles.message, { color: theme.heroTexteSecondaire }]}>
          {t('prise.detail', { detail })}
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
            surFondSombre
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
          <View style={styles.commandes}>
            <Pressable
              accessibilityRole="button"
              onPress={() => void refaire()}
              style={({ pressed }) => [styles.commande, pressed && styles.presse]}
            >
              <Text style={[styles.commandeTexte, { color: theme.heroTexteSecondaire }]}>
                {t('prise.refaire')}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('prise.terminer')}
              onPress={() => void terminer()}
              style={({ pressed }) => [
                styles.stop,
                { backgroundColor: theme.heroCarte, borderColor: theme.heroBordure },
                pressed && styles.presse,
              ]}
            >
              <View style={[styles.carre, { backgroundColor: theme.voix }]} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => void terminer()}
              style={({ pressed }) => [styles.commande, pressed && styles.presse]}
            >
              <Text
                style={[styles.commandeTexte, styles.droite, { color: theme.heroTexteSecondaire }]}
              >
                {t('prise.terminer')}
              </Text>
            </Pressable>
          </View>
        ) : null}
        {phase !== 'en_cours' ? (
          <Bouton
            libelle={t('prise.annuler')}
            variante="texte"
            surFondSombre
            onPress={() => {
              void abandonner().then(onAnnuler)
            }}
          />
        ) : null}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  contenu: { flexGrow: 1, paddingHorizontal: espaces.xl, gap: espaces.m },
  bandeau: { gap: espaces.xxs },
  tete: { gap: 14 },
  teteCentree: { gap: espaces.xs, alignItems: 'center' },
  surtitre: {
    fontFamily: polices.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  titreDiagnostic: {
    fontFamily: polices.extraBold,
    fontSize: 29,
    lineHeight: 34,
    letterSpacing: -0.8,
    marginTop: espaces.xs,
  },
  titrePetit: { fontFamily: polices.semiBold, fontSize: 12, lineHeight: 16, textAlign: 'center' },
  consignePetite: {
    fontFamily: polices.medium,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  texte: { gap: espaces.s },
  appui: { gap: 2 },
  appuisPrise: { alignSelf: 'stretch', gap: espaces.xxs },
  appuiPrise: { fontFamily: polices.semiBold, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 44 },
  chronoBloc: { alignItems: 'center', gap: 6 },
  chronoGrand: {
    fontFamily: polices.bold,
    fontSize: 56,
    lineHeight: 64,
    letterSpacing: -1.7,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  chronoAnneau: {
    fontFamily: polices.extraBold,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -1.2,
    fontVariant: ['tabular-nums'],
  },
  plage: { fontFamily: polices.semiBold, fontSize: 12, lineHeight: 16 },
  ondeEtroite: { width: '78%' },
  ecoute: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  ecouteTexte: { fontFamily: polices.semiBold, fontSize: 13, lineHeight: 18 },
  message: { textAlign: 'center' },
  actions: { marginTop: 'auto', gap: espaces.xs, paddingTop: espaces.l },
  commandes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  commande: { width: 92, minHeight: 44, justifyContent: 'center' },
  commandeTexte: { fontFamily: polices.semiBold, fontSize: 15, lineHeight: 20 },
  droite: { textAlign: 'right' },
  stop: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carre: { width: 32, height: 32, borderRadius: rayons.s - 2 },
  presse: { opacity: 0.85 },
})
