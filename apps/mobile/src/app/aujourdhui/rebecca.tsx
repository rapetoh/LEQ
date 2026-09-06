import { useRouter } from 'expo-router'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { CarteAtelier } from '@/components/CarteAtelier'
import { CartePlaceholder } from '@/components/CartePlaceholder'
import { Bouton } from '@/components/ui/Bouton'
import { Carte } from '@/components/ui/Carte'
import { Titre } from '@/components/ui/Titre'
import { t } from '@/i18n/fr'
import { useBoutique } from '@/services/progres'
import { useAnnonces, useAteliers } from '@/services/rebecca'
import { ilYA } from '@/services/rythme'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, typographie } from '@/theme/tokens'

// B1b · Avec Rebecca, le détail. Her workshops, then her announcements. The announcements
// live after the défi, never before: first you speak, then you are invited. A door, not a sale.

export default function AvecRebecca() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const ateliers = useAteliers()
  const annonces = useAnnonces()
  const boutique = useBoutique()
  const couts = new Map(
    (boutique.data?.recompenses ?? []).map((r) => [r.id, r.cout_points] as const),
  )

  return (
    <ScrollView
      style={{ backgroundColor: theme.fond }}
      contentContainerStyle={[
        styles.contenu,
        { paddingTop: insets.top + espaces.xl, paddingBottom: insets.bottom + espaces.xl },
      ]}
    >
      <Titre niveau="ecran">{t('rebecca.detailTitre')}</Titre>

      {ateliers.isPending ? (
        <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
          {t('commun.chargement')}
        </Text>
      ) : !ateliers.data || ateliers.data.length === 0 ? (
        <CartePlaceholder titre={t('rebecca.ateliers')} phrase={t('rebecca.ateliersPlaceholder')} />
      ) : (
        ateliers.data.map((atelier) => (
          <CarteAtelier
            key={atelier.id}
            atelier={atelier}
            coutPlace={atelier.recompense_id ? (couts.get(atelier.recompense_id) ?? null) : null}
          />
        ))
      )}

      <Carte style={styles.bloc}>
        <Text style={[typographie.titreCarte, { color: theme.texte }]}>
          {t('rebecca.individuel')}
        </Text>
        <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
          {t('rebecca.individuelDetail')}
        </Text>
      </Carte>

      <View style={styles.section}>
        <Titre niveau="section">{t('rebecca.annonces')}</Titre>
        {annonces.data && annonces.data.length > 0 ? (
          <Carte style={styles.liste}>
            {annonces.data.map((annonce, index) => (
              <View
                key={annonce.id}
                style={[
                  styles.annonce,
                  index > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: theme.bordure,
                  },
                ]}
              >
                <Text style={[typographie.corpsFort, { color: theme.texte }]}>{annonce.titre}</Text>
                <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
                  {annonce.corps}
                </Text>
                <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>
                  {ilYA(annonce.envoyee_le)}
                </Text>
              </View>
            ))}
          </Carte>
        ) : (
          <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
            {t('rebecca.aucuneAnnonce')}
          </Text>
        )}
      </View>

      <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>{t('rebecca.porte')}</Text>

      <View style={styles.actions}>
        <Bouton libelle={t('rebecca.retour')} variante="texte" onPress={() => router.back()} />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  contenu: { flexGrow: 1, paddingHorizontal: espaces.xl, gap: espaces.m },
  bloc: { gap: espaces.xs },
  section: { gap: espaces.s },
  liste: { paddingVertical: 0 },
  annonce: { gap: 2, paddingVertical: espaces.m },
  actions: { marginTop: 'auto', paddingTop: espaces.l },
})
