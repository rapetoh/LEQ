import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Bouton } from '@/components/ui/Bouton'
import { Carte } from '@/components/ui/Carte'
import { Titre } from '@/components/ui/Titre'
import { t } from '@/i18n/fr'
import { creerDuel, invaliderArene, messageRefus } from '@/services/arene'
import { compter } from '@/services/usage'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, rayons, typographie } from '@/theme/tokens'

// C5 · Défier un ami. The subject, and the duel exists: its own screen then carries the
// invitation to send, the seat that waits, and the person's own take. Rebecca's bank of
// subjects arrives with her.

export default function NouveauDuel() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const clientRequetes = useQueryClient()
  const [sujet, setSujet] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  const creer = async () => {
    setEnvoi(true)
    setMessage(null)
    try {
      const duel = await creerDuel(sujet.trim())
      compter('duel_cree')
      invaliderArene(clientRequetes)
      router.replace(`/duel/${duel.id}`)
    } catch (erreur) {
      setMessage(messageRefus(erreur))
      setEnvoi(false)
    }
  }

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: theme.fond }}
      contentContainerStyle={[
        styles.contenu,
        { paddingTop: insets.top + espaces.xl, paddingBottom: insets.bottom + espaces.xl },
      ]}
    >
      <Text style={[typographie.etiquette, { color: theme.texteTertiaire }]}>
        {t('duel.surtitre')}
      </Text>
      <Titre niveau="ecran">{t('duel.nouveauTitre')}</Titre>

      <Carte style={styles.bloc}>
        <Text style={[typographie.corpsFort, { color: theme.texte }]}>{t('duel.sujetTitre')}</Text>
        <TextInput
          accessibilityLabel={t('duel.sujetTitre')}
          value={sujet}
          onChangeText={setSujet}
          multiline
          autoFocus
          placeholder={t('duel.sujetExemple')}
          placeholderTextColor={theme.texteTertiaire}
          style={[
            typographie.corps,
            styles.champ,
            { color: theme.texte, borderColor: theme.bordure, backgroundColor: theme.fond },
          ]}
        />
        <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>
          {t('duel.sujetAide')}
        </Text>
      </Carte>
      <Bouton
        libelle={t('duel.creer')}
        desactive={sujet.trim().length === 0}
        chargement={envoi}
        onPress={() => void creer()}
      />
      {message ? (
        <Text style={[typographie.corps, styles.centre, { color: theme.erreur }]}>{message}</Text>
      ) : null}

      <View style={styles.actions}>
        <Bouton libelle={t('commun.retour')} variante="texte" onPress={() => router.back()} />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  contenu: { flexGrow: 1, paddingHorizontal: espaces.xl, gap: espaces.m },
  bloc: { gap: espaces.s },
  champ: { borderWidth: 1, borderRadius: rayons.l, padding: espaces.m, minHeight: 96 },
  centre: { textAlign: 'center' },
  actions: { marginTop: 'auto', paddingTop: espaces.l },
})
