import { randomUUID } from 'expo-crypto'
import { useNetworkState } from 'expo-network'
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Bulle } from '@/components/Bulle'
import { Onde } from '@/components/Onde'
import { Bouton } from '@/components/ui/Bouton'
import { Carte } from '@/components/ui/Carte'
import { Titre } from '@/components/ui/Titre'
import { t } from '@/i18n/fr'
import { enregistrerReponsesAccueil, type ReponsesLocales } from '@/services/accueil'
import { useConfiguration } from '@/services/configuration'
import { enregistrement } from '@/services/enregistrement'
import { demanderMicro } from '@/services/micro'
import { file, horodatageLocal } from '@/services/prises'
import { ecrireJson, lireJson, CLES } from '@/services/stockage'
import { supabase } from '@/services/supabase'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, typographie } from '@/theme/tokens'

// A4 · La prise de diagnostic, and X4 when offline. One take of 60 to 90 seconds.
// The room goes quiet: Bulle listens without moving, nothing judges.

const NB_BARRES = 40
type Phase = 'pret' | 'en_cours' | 'terminee' | 'erreur'

function formater(secondes: number): string {
  const s = Math.max(0, Math.floor(secondes))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function Prise() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const reseau = useNetworkState()
  const configuration = useConfiguration()
  const min = configuration.data?.duree_diagnostic_min_s ?? 60
  const max = configuration.data?.duree_diagnostic_max_s ?? 90

  const [phase, setPhase] = useState<Phase>('pret')
  const [secondes, setSecondes] = useState(0)
  const [niveaux, setNiveaux] = useState<number[]>(() => Array<number>(NB_BARRES).fill(-100))
  const [message, setMessage] = useState<string | null>(null)
  const idRef = useRef<string | null>(null)
  const minuteur = useRef<ReturnType<typeof setInterval> | null>(null)
  const maxRef = useRef(max)
  useEffect(() => {
    maxRef.current = max
  }, [max])

  const horsLigne = reseau.isConnected === false

  const abandonner = async () => {
    await enregistrement.annuler()
    if (idRef.current) {
      await file.annuler(idRef.current).catch(() => undefined)
      idRef.current = null
    }
    if (minuteur.current) clearInterval(minuteur.current)
  }

  // Leaving the screen mid-take throws the take away (a partial file is never uploaded).
  useEffect(() => {
    return () => {
      if (minuteur.current) clearInterval(minuteur.current)
      if (enregistrement.estEnCours()) void abandonner()
    }
  }, [])

  const demarrer = async () => {
    setMessage(null)
    if ((await demanderMicro()) !== 'accorde') {
      setMessage(t('prise.micRefuse'))
      return
    }
    const id = randomUUID()
    idRef.current = id
    try {
      await file.commencer({ id, type: 'diagnostic', ...horodatageLocal() })
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
    }
  }

  const terminer = async () => {
    const id = idRef.current
    if (!id || !enregistrement.estEnCours()) return
    if (enregistrement.duree() < min) {
      setMessage(t('prise.tropCourte', { min }))
      return
    }
    if (minuteur.current) clearInterval(minuteur.current)
    try {
      const prise = await enregistrement.arreter()
      await file.terminer(id, prise)
      await ecrireJson(CLES.priseDiagnostic, id)
      setPhase('terminee')
      void envoyerReponses()
      void file.envoyerEnAttente()
      router.replace({ pathname: '/accueil/analyse', params: { id } })
    } catch (erreur) {
      console.warn('prise: arrêt impossible', erreur)
      await abandonner()
      setPhase('erreur')
      setMessage(t('prise.erreur'))
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
      style={{ backgroundColor: theme.fond }}
      contentContainerStyle={[
        styles.contenu,
        { paddingTop: insets.top + espaces.xl, paddingBottom: insets.bottom + espaces.xl },
      ]}
    >
      {horsLigne ? (
        <Carte teinte="voix" style={styles.bandeau}>
          <Text style={[typographie.etiquette, { color: theme.texte }]}>
            {t('prise.horsLigne')}
          </Text>
          <Text style={[typographie.petit, { color: theme.texteSecondaire }]}>
            {t('prise.horsLigneDetail')}
          </Text>
        </Carte>
      ) : null}

      <Text style={[typographie.etiquette, { color: theme.texteTertiaire }]}>
        {t('prise.surtitre')}
      </Text>
      <Titre niveau="ecran">{t('prise.unePrise')}</Titre>
      <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
        {t('prise.consigne')}
      </Text>

      <View style={styles.centre}>
        <Bulle taille="petite" calme={phase === 'en_cours'} />
        <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>
          {phase === 'en_cours' ? t('prise.ecouteCalme') : t('prise.ecoute')}
        </Text>
        <Text style={[typographie.chiffre, { color: theme.texte }]}>{formater(secondes)}</Text>
        <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>
          {t('prise.plage', { min: formater(min), max: formater(max) })}
        </Text>
        <Onde niveaux={niveaux} />
      </View>

      {message ? (
        <Text style={[typographie.corps, styles.message, { color: theme.texteSecondaire }]}>
          {message}
        </Text>
      ) : null}

      <View style={styles.actions}>
        {phase === 'pret' || phase === 'erreur' ? (
          <Bouton libelle={t('prise.demarrer')} onPress={() => void demarrer()} />
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
          onPress={() => {
            void abandonner().then(() => router.back())
          }}
        />
      </View>
    </ScrollView>
  )
}

async function envoyerReponses(): Promise<void> {
  try {
    const reponses = await lireJson<ReponsesLocales>(CLES.reponsesAccueil)
    const { data } = await supabase.auth.getSession()
    const id = data.session?.user.id
    if (reponses && id) await enregistrerReponsesAccueil(id, reponses)
  } catch (erreur) {
    console.warn('accueil: réponses non envoyées, nouvel essai plus tard', erreur)
  }
}

const styles = StyleSheet.create({
  contenu: { flexGrow: 1, paddingHorizontal: espaces.xl, gap: espaces.m },
  bandeau: { gap: espaces.xxs },
  centre: { alignItems: 'center', gap: espaces.s, marginTop: espaces.l },
  message: { textAlign: 'center' },
  actions: { marginTop: 'auto', gap: espaces.s, paddingTop: espaces.l },
})
