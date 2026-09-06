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
      style={{ backgroundColor: theme.fond }}
      contentContainerStyle={[
        styles.contenu,
        { paddingTop: insets.top + espaces.xl, paddingBottom: insets.bottom + espaces.xl },
      ]}
    >
      <Text style={[typographie.etiquette, { color: theme.texteTertiaire }]}>
        {t('questions.compteur', { numero: index + 1, total: QUESTIONS_ACCUEIL.length })}
      </Text>
      <Titre niveau="ecran">{question.question}</Titre>

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
              style={[
                styles.option,
                {
                  backgroundColor: actif ? theme.accentDoux : theme.carte,
                  borderColor: actif ? theme.accent : theme.bordure,
                },
              ]}
            >
              <Text style={[typographie.corpsFort, { color: theme.texte }]}>{libelle}</Text>
            </Pressable>
          )
        })}
      </View>

      <View style={styles.actions}>
        <Bouton libelle={t('questions.continuer')} onPress={continuer} desactive={!choix} />
        <Text style={[typographie.petit, styles.note, { color: theme.texteTertiaire }]}>
          {t('questions.note')}
        </Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  contenu: { flexGrow: 1, paddingHorizontal: espaces.xl, gap: espaces.l },
  options: { gap: espaces.s },
  option: { padding: espaces.m, borderRadius: rayons.l, borderWidth: 1.5 },
  actions: { marginTop: 'auto', gap: espaces.s, paddingTop: espaces.l },
  note: { textAlign: 'center' },
})
