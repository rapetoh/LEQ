import {
  QUESTIONS_ACCUEIL,
  type BlocageAccueil,
  type ContexteAccueil,
  type ObjectifAccueil,
} from '@leq/domaine'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Bouton } from '@/components/ui/Bouton'
import { Titre } from '@/components/ui/Titre'
import { t } from '@/i18n/fr'
import { type ReponsesLocales } from '@/services/accueil'
import { ecrireJson, CLES } from '@/services/stockage'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, rayons, typographie } from '@/theme/tokens'

// A3 · Trois questions. One screen per question, answered by touch, never typed.

type Reponses = Partial<ReponsesLocales>

export default function Questions() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [index, setIndex] = useState(0)
  const [reponses, setReponses] = useState<Reponses>({})

  const question = QUESTIONS_ACCUEIL[index]
  if (!question) return null
  const choix = reponses[question.cle]

  const continuer = () => {
    if (index + 1 < QUESTIONS_ACCUEIL.length) {
      setIndex(index + 1)
      return
    }
    const completes = reponses as ReponsesLocales
    void ecrireJson(CLES.reponsesAccueil, completes)
    router.push('/accueil/prise')
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.hero }}
      contentContainerStyle={[
        styles.contenu,
        { paddingTop: insets.top + espaces.xl, paddingBottom: insets.bottom + espaces.xl },
      ]}
    >
      <View style={styles.compteur}>
        <Text
          style={[typographie.etiquette, styles.majuscules, { color: theme.heroTexteSecondaire }]}
        >
          {t('questions.compteur', { numero: index + 1, total: QUESTIONS_ACCUEIL.length })}
        </Text>
        <View style={styles.barres}>
          {QUESTIONS_ACCUEIL.map((q, i) => (
            <View
              key={q.cle}
              style={[styles.barre, { backgroundColor: i <= index ? theme.voix : theme.heroCarte }]}
            />
          ))}
        </View>
      </View>
      <Titre niveau="ecran" surFondSombre>
        {question.question}
      </Titre>

      <View style={styles.options} accessibilityRole="radiogroup">
        {question.options.map((option) => {
          const actif = choix === option
          const libelle = (question.libelles as Record<string, string>)[option] ?? option
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected: actif }}
              onPress={() =>
                setReponses({
                  ...reponses,
                  [question.cle]: option as ContexteAccueil & BlocageAccueil & ObjectifAccueil,
                })
              }
              style={[styles.option, { backgroundColor: actif ? theme.voix : theme.heroCarte }]}
            >
              <Text
                style={[
                  typographie.corpsFort,
                  { color: actif ? theme.hero : theme.heroTexte, flex: 1 },
                ]}
              >
                {libelle}
              </Text>
              {actif ? <Text style={[typographie.corpsFort, { color: theme.hero }]}>✓</Text> : null}
            </Pressable>
          )
        })}
      </View>

      <View style={styles.actions}>
        <Bouton libelle={t('questions.continuer')} onPress={continuer} desactive={!choix} />
        <Text style={[typographie.petit, styles.note, { color: theme.heroTexteSecondaire }]}>
          {t('questions.note')}
        </Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  contenu: { flexGrow: 1, paddingHorizontal: espaces.xl, gap: espaces.l },
  options: { gap: espaces.s },
  compteur: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  majuscules: { textTransform: 'uppercase' },
  barres: { flexDirection: 'row', gap: espaces.xxs },
  barre: { width: 22, height: 5, borderRadius: 3 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaces.s,
    padding: espaces.m,
    borderRadius: rayons.l,
  },
  actions: { marginTop: 'auto', gap: espaces.s, paddingTop: espaces.l },
  note: { textAlign: 'center' },
})
