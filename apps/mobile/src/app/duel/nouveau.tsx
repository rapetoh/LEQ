import { useQueryClient } from '@tanstack/react-query'
import * as Clipboard from 'expo-clipboard'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Bouton } from '@/components/ui/Bouton'
import { Carte } from '@/components/ui/Carte'
import { Titre } from '@/components/ui/Titre'
import { t } from '@/i18n/fr'
import { creerDuel, invaliderArene, messageRefus } from '@/services/arene'
import { lienInvitationDuel } from '@leq/domaine'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, rayons, typographie } from '@/theme/tokens'

// C5 · Défier un ami. The subject, then the link. The person answers within 48 hours, alone,
// and the link works even without the app. Rebecca's bank of subjects arrives with her.

// Where the public pages live. Today that is the Fly process that serves apps/web; Phase 9
// points EXPO_PUBLIC_LIEN_DUEL at the real domain, and nothing else changes.
const BASE_LIEN = process.env.EXPO_PUBLIC_LIEN_DUEL ?? 'https://leq-serveur.fly.dev'

export default function NouveauDuel() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const clientRequetes = useQueryClient()
  const [sujet, setSujet] = useState('')
  const [lien, setLien] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  const creer = async () => {
    setEnvoi(true)
    setMessage(null)
    try {
      const duel = await creerDuel(sujet.trim())
      setLien(lienInvitationDuel(BASE_LIEN, duel.jeton))
      invaliderArene(clientRequetes)
    } catch (erreur) {
      setMessage(messageRefus(erreur))
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.fond }}
      contentContainerStyle={[
        styles.contenu,
        { paddingTop: insets.top + espaces.xl, paddingBottom: insets.bottom + espaces.xl },
      ]}
    >
      <Titre niveau="ecran">{t('arene.defier')}</Titre>

      {lien === null ? (
        <>
          <Carte style={styles.bloc}>
            <Text style={[typographie.corpsFort, { color: theme.texte }]}>
              {t('arene.duelSujet')}
            </Text>
            <TextInput
              accessibilityLabel={t('arene.duelSujet')}
              value={sujet}
              onChangeText={setSujet}
              multiline
              placeholder={t('arene.duelSujetAide')}
              placeholderTextColor={theme.texteTertiaire}
              style={[
                typographie.corps,
                styles.champ,
                { color: theme.texte, borderColor: theme.bordure },
              ]}
            />
            <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>
              {t('arene.duelDelai')}
            </Text>
          </Carte>
          <Bouton
            libelle={t('arene.duelCreer')}
            desactive={sujet.trim().length === 0}
            chargement={envoi}
            onPress={() => void creer()}
          />
        </>
      ) : (
        <Carte teinte="voix" style={styles.bloc}>
          <Text style={[typographie.corpsFort, { color: theme.texte }]}>{t('arene.duelLien')}</Text>
          <Text style={[typographie.petit, { color: theme.texteSecondaire }]}>{lien}</Text>
          <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>
            {t('arene.duelLienAide')}
          </Text>
          <Bouton
            libelle={t('arene.duelCopier')}
            onPress={() => {
              void Clipboard.setStringAsync(lien).then(() => setMessage(t('arene.duelCopie')))
            }}
          />
        </Carte>
      )}

      {message ? (
        <Text style={[typographie.corps, styles.centre, { color: theme.texteSecondaire }]}>
          {message}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Bouton
          libelle={lien === null ? t('commun.retour') : t('commun.fermer')}
          variante="texte"
          onPress={() => router.back()}
        />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  contenu: { flexGrow: 1, paddingHorizontal: espaces.xl, gap: espaces.m },
  bloc: { gap: espaces.s },
  champ: { borderWidth: 1, borderRadius: rayons.l, padding: espaces.m, minHeight: 88 },
  centre: { textAlign: 'center' },
  actions: { marginTop: 'auto', paddingTop: espaces.l },
})
