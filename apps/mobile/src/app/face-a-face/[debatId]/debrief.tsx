import { useQuery } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Bulle } from '@/components/Bulle'
import { EcranChargement, EcranErreur } from '@/components/EcransEtat'
import { Bouton } from '@/components/ui/Bouton'
import { Carte } from '@/components/ui/Carte'
import { Titre } from '@/components/ui/Titre'
import { t } from '@/i18n/fr'
import { chargerTranscription, messageRefus, useDebat } from '@/services/debat'
import { Icone } from '@/components/ui/Icone'
import { useBarreEtatClaire } from '@/components/BarreEtat'
import { FondSombre } from '@/theme/FondSombre'
import { useTheme } from '@/theme/ThemeProvider'
import { couleurs, espaces, polices, rayons, typographie } from '@/theme/tokens'

// E4 · Le débrief. Written from the text of the debate and never from its sound, because there
// is no sound kept anywhere (chapter 2). The screen says so, at the bottom, in one line.
//
// The note names moments of the debate, so the debate itself is one tap below it: a person who
// reads « tu as lâché sur la deuxième objection » wants to see that objection again, and the
// text is all that is kept of it.

/** The worker writes the note a moment after the debate ends; the screen waits for it. */
const INTERVALLE_MS = 4000
/** After this many tries the note is not coming, and saying so beats a spinner that never ends. */
const ESSAIS_MAX = 30

export default function Debrief() {
  const theme = useTheme()
  useBarreEtatClaire()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { debatId = '' } = useLocalSearchParams<{ debatId: string }>()
  const debat = useDebat(debatId)
  const debrief = debat.data?.debrief ?? null

  const [essais, setEssais] = useState(0)
  const [relire, setRelire] = useState(false)
  const rafraichir = debat.refetch
  const transcription = useQuery({
    queryKey: ['transcription_debat', debatId],
    queryFn: () => chargerTranscription(debatId),
    enabled: debatId !== '' && relire,
    staleTime: 60_000,
  })

  useEffect(() => {
    if (debrief !== null || debat.isError || essais >= ESSAIS_MAX) return
    const battement = setInterval(() => {
      setEssais((precedents) => precedents + 1)
      void rafraichir()
    }, INTERVALLE_MS)
    return () => clearInterval(battement)
  }, [debrief, debat.isError, essais, rafraichir])

  if (debat.isPending) return <EcranChargement />
  if (debat.isError || !debat.data) {
    return (
      <EcranErreur message={messageRefus(debat.error)} reessayer={() => void debat.refetch()} />
    )
  }

  return (
    <FondSombre>
      <ScrollView
        style={{ backgroundColor: theme.hero }}
        contentContainerStyle={[
          styles.contenu,
          { paddingTop: insets.top + espaces.xl, paddingBottom: insets.bottom + espaces.xxl },
        ]}
      >
        <View style={styles.entete}>
          <Bulle taille="moyenne" visage={debrief ? 'sourit' : 'attend'} calme />
          <Text style={[typographie.etiquette, styles.majuscules, { color: theme.voix }]}>
            {t('debat.titre')}
          </Text>
          <Titre niveau="ecran" surFondSombre centre>
            {debrief ? t('debat.debriefTitre') : t('debat.debriefEnCours')}
          </Titre>
          <Text style={[typographie.corps, styles.centre, { color: theme.heroTexteSecondaire }]}>
            {debat.data.these_texte}
          </Text>
        </View>

        {!debrief ? (
          <Text style={[typographie.corps, styles.centre, { color: theme.heroTexteSecondaire }]}>
            {essais >= ESSAIS_MAX ? t('debat.debriefTarde') : t('debat.debriefEnCoursDetail')}
          </Text>
        ) : debrief.provisoire ? (
          <Carte teinte="sombre" style={styles.bloc}>
            <Text style={[typographie.corps, { color: theme.heroTexteSecondaire }]}>
              {t('debat.debriefProvisoire')}
            </Text>
          </Carte>
        ) : debrief.moments.length === 0 ? (
          <Carte teinte="sombre" style={styles.bloc}>
            <Text style={[typographie.corps, { color: theme.heroTexteSecondaire }]}>
              {t('debat.debriefVide')}
            </Text>
          </Carte>
        ) : (
          <>
            <Text style={[typographie.etiquette, styles.majuscules, { color: theme.voix }]}>
              {t('debat.debriefMoments')}
            </Text>
            {debrief.moments.map((moment, index) => (
              <Carte key={index} teinte="sombre" style={styles.bloc}>
                <Text style={[typographie.corps, { color: theme.heroTexte }]}>{moment}</Text>
              </Carte>
            ))}
            <Text style={[typographie.etiquette, styles.majuscules, { color: theme.voix }]}>
              {t('debat.debriefAxe')}
            </Text>
            <Carte teinte="voix" style={styles.bloc}>
              <Text style={[typographie.corpsFort, { color: theme.texte }]}>{debrief.axe}</Text>
            </Carte>
          </>
        )}

        <Pressable
          accessibilityRole="button"
          onPress={() => setRelire((ouvert) => !ouvert)}
          style={({ pressed }) => [styles.relire, pressed && { opacity: 0.85 }]}
        >
          <Text style={[typographie.corpsFort, { color: theme.voix }]}>
            {relire ? t('debat.debriefMasquer') : t('debat.debriefRelire')}
          </Text>
          <Icone
            sf={relire ? 'chevron.up' : 'chevron.down'}
            material={relire ? 'expand-less' : 'expand-more'}
            taille={16}
            couleur={theme.voix}
          />
        </Pressable>

        {relire
          ? (transcription.data ?? []).map((tour) => (
              <View
                key={tour.numero}
                style={[
                  styles.tour,
                  tour.locuteur === 'retor'
                    ? { borderColor: theme.heroBordure }
                    : { borderColor: 'transparent', backgroundColor: 'rgba(255, 189, 89, 0.14)' },
                ]}
              >
                <Text
                  style={[
                    styles.locuteur,
                    { color: tour.locuteur === 'retor' ? couleurs.or : couleurs.encre3 },
                  ]}
                >
                  {tour.locuteur === 'retor' ? t('debat.retor') : t('debat.toi')}
                </Text>
                <Text style={[typographie.corps, { color: couleurs.blanc }]}>{tour.texte}</Text>
              </View>
            ))
          : null}

        <View style={styles.actions}>
          <Text style={[typographie.petit, styles.centre, { color: theme.heroTexteSecondaire }]}>
            {t('debat.debriefSource')}
          </Text>
          <Bouton
            libelle={t('debat.debriefAutre')}
            onPress={() => router.replace('/face-a-face')}
          />
          <Bouton
            libelle={t('commun.retour')}
            variante="secondaire"
            onPress={() => router.replace('/(onglets)/moi')}
          />
        </View>
      </ScrollView>
    </FondSombre>
  )
}

const styles = StyleSheet.create({
  contenu: { flexGrow: 1, paddingHorizontal: espaces.xl, gap: espaces.s },
  entete: { alignItems: 'center', gap: espaces.xs, marginBottom: espaces.s },
  centre: { textAlign: 'center' },
  majuscules: { textTransform: 'uppercase' },
  bloc: { gap: espaces.xxs },
  relire: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: espaces.s,
  },
  tour: {
    borderWidth: 1,
    borderRadius: rayons.l,
    paddingHorizontal: espaces.m,
    paddingVertical: espaces.s,
    gap: 3,
  },
  locuteur: {
    fontFamily: polices.extraBold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  actions: { marginTop: 'auto', paddingTop: espaces.l, gap: espaces.s },
})
