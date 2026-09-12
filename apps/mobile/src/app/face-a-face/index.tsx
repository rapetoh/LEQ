import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Bulle } from '@/components/Bulle'
import { EcranChargement } from '@/components/EcransEtat'
import { Bouton } from '@/components/ui/Bouton'
import { Carte } from '@/components/ui/Carte'
import { Titre } from '@/components/ui/Titre'
import { t } from '@/i18n/fr'
import {
  abandonnerDebat,
  invaliderDebats,
  messageRefus,
  ouvrirDebat,
  useDebatAReprendre,
  useQuotaDebats,
  useTheses,
  type These,
} from '@/services/debat'
import { useTheme } from '@/theme/ThemeProvider'
import { couleurs, espaces, rayons, typographie } from '@/theme/tokens'

// E2 · Préparer le face-à-face. The bank first, one's own thesis second and quietly: most
// people asked to invent a debate subject freeze, or pick something they cannot defend, and
// the session is lost before it has started (cahier chapter 10).

const TONS = ['ferme', 'provocateur', 'academique', 'bienveillant'] as const
type Ton = (typeof TONS)[number]

const LIBELLE_TON: Record<Ton, Parameters<typeof t>[0]> = {
  ferme: 'debat.tonFerme',
  provocateur: 'debat.tonProvocateur',
  academique: 'debat.tonAcademique',
  bienveillant: 'debat.tonBienveillant',
}

export default function PreparerDebat() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const clientRequetes = useQueryClient()
  const theses = useTheses()
  const quota = useQuotaDebats()
  const reprise = useDebatAReprendre()

  const [choisie, setChoisie] = useState<These | null>(null)
  const [personnelle, setPersonnelle] = useState('')
  const [ecrireLaSienne, setEcrireLaSienne] = useState(false)
  const [ton, setTon] = useState<Ton | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  if (theses.isPending || quota.isPending || reprise.isPending) return <EcranChargement />

  const restantes = quota.data?.restants ?? 0
  const aReprendre = reprise.data ?? null
  const banqueVide = (theses.data?.length ?? 0) === 0
  // With no bank there is only one way in, so the screen opens it rather than asking twice.
  const ecrireVraiment = ecrireLaSienne || banqueVide

  const commencer = async (abandonnerLAutre = false) => {
    setEnvoi(true)
    setMessage(null)
    try {
      if (abandonnerLAutre) await abandonnerDebat()
      const debat = await ouvrirDebat({
        theseId: ecrireVraiment ? null : (choisie?.id ?? null),
        theseTexte: ecrireVraiment ? personnelle.trim() : null,
        ton: ton ?? null,
      })
      invaliderDebats(clientRequetes)
      router.replace(`/face-a-face/${debat.id}`)
    } catch (erreur) {
      setMessage(messageRefus(erreur))
    } finally {
      setEnvoi(false)
    }
  }

  const pret = ecrireVraiment ? personnelle.trim().length > 0 : choisie !== null

  return (
    <ScrollView
      style={{ backgroundColor: theme.hero }}
      contentContainerStyle={[
        styles.contenu,
        { paddingTop: insets.top + espaces.xl, paddingBottom: insets.bottom + espaces.xxl },
      ]}
    >
      <View style={styles.entete}>
        <Bulle taille="moyenne" visage="parle" />
        <Text style={[typographie.etiquette, styles.majuscules, { color: theme.voix }]}>
          {t('debat.titre')}
        </Text>
        <Titre niveau="ecran" surFondSombre centre>
          {t('debat.preparerTitre')}
        </Titre>
        <Text style={[typographie.corps, styles.centre, { color: theme.heroTexteSecondaire }]}>
          {t('debat.preparerCorps')}
        </Text>
      </View>

      {aReprendre ? (
        <Carte teinte="voix" style={styles.bloc}>
          <Titre niveau="carte">{t('debat.repriseTitre')}</Titre>
          <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
            {t('debat.repriseCorps')}
          </Text>
          <Bouton
            libelle={t('debat.reprendre')}
            onPress={() => router.replace(`/face-a-face/${aReprendre.id}`)}
          />
        </Carte>
      ) : null}

      {banqueVide ? (
        <Carte teinte="sombre" style={styles.bloc}>
          <Titre niveau="carte" surFondSombre>
            {t('debat.banqueVide')}
          </Titre>
          <Text style={[typographie.corps, { color: theme.heroTexteSecondaire }]}>
            {t('debat.banqueVideCorps')}
          </Text>
        </Carte>
      ) : (
        <Text style={[typographie.etiquette, styles.majuscules, { color: theme.voix }]}>
          {t('debat.choisirSujet')}
        </Text>
      )}
      {theses.data?.map((these) => {
        const active = !ecrireVraiment && choisie?.id === these.id
        return (
          <Pressable
            key={these.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => {
              setEcrireLaSienne(false)
              setChoisie(these)
              setTon(null)
            }}
          >
            <Carte teinte="sombre" style={[styles.these, active && { borderColor: theme.voix }]}>
              <Text style={[typographie.corpsFort, { color: theme.heroTexte }]}>{these.texte}</Text>
            </Carte>
          </Pressable>
        )
      })}

      {banqueVide ? null : (
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ selected: ecrireLaSienne }}
          onPress={() => setEcrireLaSienne(true)}
        >
          <Text style={[typographie.petit, styles.lien, { color: theme.voix }]}>
            {t('debat.monSujet')}
          </Text>
        </Pressable>
      )}

      {ecrireVraiment ? (
        <Carte teinte="sombre" style={styles.bloc}>
          <Text style={[typographie.etiquette, { color: theme.heroTexteSecondaire }]}>
            {t('debat.monSujetChamp')}
          </Text>
          <TextInput
            value={personnelle}
            onChangeText={setPersonnelle}
            multiline
            placeholder={t('debat.monSujetAide')}
            placeholderTextColor={theme.heroTexteSecondaire}
            style={[
              typographie.corps,
              styles.champ,
              { color: theme.heroTexte, borderColor: theme.heroBordure },
            ]}
          />
        </Carte>
      ) : null}

      <Text style={[typographie.etiquette, styles.majuscules, { color: theme.voix }]}>
        {t('debat.ton')}
      </Text>
      <View style={styles.tons}>
        {TONS.map((cle) => {
          const actif =
            ton === cle || (ton === null && !ecrireLaSienne && choisie?.ton_suggere === cle)
          return (
            <Pressable
              key={cle}
              accessibilityRole="radio"
              accessibilityState={{ selected: actif }}
              onPress={() => setTon(cle)}
              style={[
                styles.pilule,
                {
                  backgroundColor: actif ? couleurs.or : 'transparent',
                  borderColor: actif ? couleurs.or : theme.heroBordure,
                },
              ]}
            >
              <Text
                style={[
                  typographie.petit,
                  { color: actif ? couleurs.bleuNuit : theme.heroTexteSecondaire },
                ]}
              >
                {t(LIBELLE_TON[cle])}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {message ? <Text style={[typographie.corps, { color: theme.accent }]}>{message}</Text> : null}

      <View style={styles.actions}>
        <Text style={[typographie.petit, { color: theme.heroTexteSecondaire }]}>
          {restantes === 1
            ? t('debat.sessionRestante')
            : restantes > 0
              ? t('debat.sessionsRestantes', { restantes })
              : t('debat.aucuneSession')}
        </Text>
        <Bouton
          libelle={t('debat.commencer')}
          chargement={envoi}
          desactive={!pret || restantes <= 0}
          onPress={() => void commencer(aReprendre !== null)}
        />
        <Text style={[typographie.petit, styles.centre, { color: theme.heroTexteSecondaire }]}>
          {t('debat.conservation')}
        </Text>
        <Bouton libelle={t('commun.retour')} variante="texte" onPress={() => router.back()} />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  contenu: { flexGrow: 1, paddingHorizontal: espaces.xl, gap: espaces.s },
  entete: { alignItems: 'center', gap: espaces.xs, marginBottom: espaces.s },
  centre: { textAlign: 'center' },
  majuscules: { textTransform: 'uppercase' },
  bloc: { gap: espaces.xs },
  these: { borderWidth: 1, borderColor: 'transparent' },
  lien: { textDecorationLine: 'underline', paddingVertical: espaces.xs },
  champ: { minHeight: 72, borderWidth: 1, borderRadius: rayons.m, padding: espaces.s },
  tons: { flexDirection: 'row', flexWrap: 'wrap', gap: espaces.xs },
  pilule: {
    paddingHorizontal: espaces.s,
    paddingVertical: espaces.xs,
    borderRadius: rayons.pilule,
    borderWidth: 1,
  },
  actions: { marginTop: 'auto', paddingTop: espaces.l, gap: espaces.s },
})
