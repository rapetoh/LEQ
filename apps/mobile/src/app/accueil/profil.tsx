import type { Mesures } from '@leq/domaine'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Bulle } from '@/components/Bulle'
import { Bouton } from '@/components/ui/Bouton'
import { Carte } from '@/components/ui/Carte'
import { Titre } from '@/components/ui/Titre'
import { t } from '@/i18n/fr'
import { lireProfilLocal } from '@/services/profilLocal'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, typographie } from '@/theme/tokens'

// A6 · Ton profil, le cadeau. Counts and measures, never a note on the voice, no
// archetype title until they are decided (docs/STRINGS.md). The grid text comes in Phase 3.

function motLePlusFrequent(mesures: Mesures): { mot: string; fois: number } | null {
  const entrees = Object.entries(mesures.mots_bequilles.par_type)
  if (entrees.length === 0) return null
  const [mot, fois] = entrees.sort((a, b) => b[1] - a[1])[0] as [string, number]
  return { mot, fois }
}

function formaterDuree(secondes: number): string {
  const s = Math.round(secondes)
  return s >= 60 ? `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s` : `${s} s`
}

export default function Profil() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [mesures, setMesures] = useState<Mesures | null>(null)

  useEffect(() => {
    void lireProfilLocal().then((profil) => setMesures(profil?.mesures ?? null))
  }, [])

  const frequent = mesures ? motLePlusFrequent(mesures) : null

  return (
    <ScrollView
      style={{ backgroundColor: theme.fond }}
      contentContainerStyle={[
        styles.contenu,
        { paddingTop: insets.top + espaces.xl, paddingBottom: insets.bottom + espaces.xl },
      ]}
    >
      <Text style={[typographie.etiquette, { color: theme.texteTertiaire }]}>
        {t('profil.surtitre')}
      </Text>
      <View style={styles.entete}>
        <Bulle taille="petite" />
        <Titre niveau="ecran">{t('profil.titre')}</Titre>
      </View>
      <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>{t('profil.intro')}</Text>

      {mesures ? (
        <View style={styles.cartes}>
          <Carte teinte="voix" style={styles.carte}>
            <Text style={[typographie.chiffre, { color: theme.texte }]}>
              {mesures.debit.mots_par_minute === null
                ? '·'
                : Math.round(mesures.debit.mots_par_minute)}
            </Text>
            <Text style={[typographie.corpsFort, { color: theme.texte }]}>{t('profil.debit')}</Text>
            <Text style={[typographie.petit, { color: theme.texteSecondaire }]}>
              {t('profil.debitZone')}
            </Text>
          </Carte>
          <Carte style={styles.carte}>
            <Text style={[typographie.chiffre, { color: theme.texte }]}>
              {mesures.mots_bequilles.total}
            </Text>
            <Text style={[typographie.corpsFort, { color: theme.texte }]}>
              {t('profil.bequilles')}
            </Text>
            <Text style={[typographie.petit, { color: theme.texteSecondaire }]}>
              {frequent
                ? t('profil.bequillesDetail', { mot: frequent.mot, fois: frequent.fois })
                : t('profil.bequillesAucun')}
            </Text>
          </Carte>
          <Carte style={styles.carte}>
            <Text style={[typographie.chiffre, { color: theme.texte }]}>
              {mesures.silences.total}
            </Text>
            <Text style={[typographie.corpsFort, { color: theme.texte }]}>
              {t('profil.silences')} ·{' '}
              {t('profil.silencesTenus', { tenus: mesures.silences.tenus })}
            </Text>
            <Text style={[typographie.petit, { color: theme.texteSecondaire }]}>
              {t('profil.silencesDetail')}
            </Text>
          </Carte>
          <Carte teinte="douce" style={styles.carte}>
            <Text style={[typographie.chiffre, { color: theme.texte }]}>
              {formaterDuree(mesures.duree_parole_s)}
            </Text>
            <Text style={[typographie.corpsFort, { color: theme.texte }]}>{t('profil.duree')}</Text>
          </Carte>
        </View>
      ) : null}

      <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>{t('profil.note')}</Text>

      <View style={styles.actions}>
        <Bouton libelle={t('profil.garder')} onPress={() => router.push('/accueil/compte')} />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  contenu: { flexGrow: 1, paddingHorizontal: espaces.xl, gap: espaces.m },
  entete: { flexDirection: 'row', alignItems: 'center', gap: espaces.s },
  cartes: { gap: espaces.s, marginTop: espaces.xs },
  carte: { gap: espaces.xxs },
  actions: { marginTop: 'auto', gap: espaces.s, paddingTop: espaces.l },
})
