import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useBarreEtatClaire } from '@/components/BarreEtat'
import { Bulle } from '@/components/Bulle'
import { EcranChargement, EcranErreur } from '@/components/EcransEtat'
import { PorteCompte } from '@/components/PorteCompte'
import { Bouton } from '@/components/ui/Bouton'
import { Icone } from '@/components/ui/Icone'
import { Titre } from '@/components/ui/Titre'
import { t } from '@/i18n/fr'
import { useActualisation } from '@/services/actualisation'
import { useEstAnonyme, versCompte } from '@/services/compte'
import { useConfiguration } from '@/services/configuration'
import {
  abandonnerDebat,
  ErreurDebat,
  invaliderDebats,
  messageRefus,
  ouvrirDebat,
  useDebatAReprendre,
  useQuotaDebats,
  useTheses,
  type These,
} from '@/services/debat'
import { compter } from '@/services/usage'
import { FondSombre } from '@/theme/FondSombre'
import { useTheme } from '@/theme/ThemeProvider'
import { couleurs, espaces, polices, rayons, typographie } from '@/theme/tokens'

// E2 · Préparer le face-à-face. The bank first, one's own thesis second and quietly: most
// people asked to invent a debate subject freeze, or pick something they cannot defend, and
// the session is lost before it has started (cahier chapter 10).
//
// The choice is made on this screen and it has to look like a choice: the thesis you picked
// carries a mark, and Rétor's tone sits inside it, because the tone belongs to the subject and
// not to a row of pills at the bottom of a long page. What the session costs (one of the month,
// so many minutes of speaking) is said where the button is, not in a footnote above it.

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
  useBarreEtatClaire()
  const { enCours: actualisation, actualiser } = useActualisation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const clientRequetes = useQueryClient()
  const theses = useTheses()
  const quota = useQuotaDebats()
  const reprise = useDebatAReprendre()
  const configuration = useConfiguration()
  const anonyme = useEstAnonyme()

  const [choisie, setChoisie] = useState<These | null>(null)
  const [personnelle, setPersonnelle] = useState('')
  const [ecrireLaSienne, setEcrireLaSienne] = useState(false)
  const [ton, setTon] = useState<Ton | null>(null)
  const [envoi, setEnvoi] = useState(false)

  if (theses.isPending || quota.isPending || reprise.isPending) return <EcranChargement />
  // A failed quota reads as zero, which would tell the person they have used sessions they have
  // not, and disable the only button on the screen. Say it failed and offer to try again.
  if (quota.isError || theses.isError) {
    return (
      <EcranErreur
        message={messageRefus(quota.error ?? theses.error)}
        reessayer={() => {
          void quota.refetch()
          void theses.refetch()
        }}
      />
    )
  }

  const restantes = quota.data?.restants ?? 0
  const aReprendre = reprise.data ?? null
  const banqueVide = (theses.data?.length ?? 0) === 0
  // With no bank there is only one way in, so the screen opens it rather than asking twice.
  const ecrireVraiment = ecrireLaSienne || banqueVide
  const secondes =
    quota.data?.formule === 'gratuit'
      ? (configuration.data?.duree_face_a_face_gratuit_s ?? 180)
      : (configuration.data?.duree_face_a_face_complet_s ?? 480)
  const minutes = Math.max(1, Math.round(secondes / 60))

  const commencer = async (abandonnerLAutre = false) => {
    setEnvoi(true)
    try {
      if (abandonnerLAutre) await abandonnerDebat()
      const debat = await ouvrirDebat({
        theseId: ecrireVraiment ? null : (choisie?.id ?? null),
        theseTexte: ecrireVraiment ? personnelle.trim() : null,
        ton: ton ?? null,
      })
      invaliderDebats(clientRequetes)
      compter('debat_ouvert', { ton: ton ?? 'defaut', these_personnelle: ecrireVraiment })
      router.replace(`/face-a-face/${debat.id}`)
    } catch (erreur) {
      // A refusal used to be one orange line at the bottom of a long page, where it was missed.
      // It takes the screen now, and the one that has a way forward offers it.
      const compteManquant = erreur instanceof ErreurDebat && erreur.refus === 'compte_requis'
      Alert.alert(
        t('debat.refusTitre'),
        messageRefus(erreur),
        compteManquant
          ? [
              { text: t('commun.plusTard'), style: 'cancel' as const },
              {
                text: t('debat.refusCreerCompte'),
                onPress: () => router.push(versCompte('debat')),
              },
            ]
          : [{ text: t('commun.fermer') }],
      )
    } finally {
      setEnvoi(false)
    }
  }

  const pret = ecrireVraiment ? personnelle.trim().length > 0 : choisie !== null
  const tonChoisi = (these: These | null): Ton | null =>
    ton ?? (these?.ton_suggere as Ton | undefined) ?? null

  const rangeeTons = (these: These | null) => (
    <View style={styles.tons}>
      {TONS.map((cle) => {
        const actif = tonChoisi(these) === cle
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
  )

  return (
    <FondSombre>
      <View style={[styles.ecran, { backgroundColor: theme.hero }]}>
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={actualisation}
              onRefresh={() => void actualiser()}
              tintColor={couleurs.blanc}
            />
          }
          contentContainerStyle={[
            styles.contenu,
            { paddingTop: insets.top + espaces.m, paddingBottom: espaces.xl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.entete}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('commun.retour')}
              onPress={() => router.back()}
              hitSlop={12}
              style={({ pressed }) => [styles.retour, pressed && styles.presse]}
            >
              <Icone
                sf="chevron.left"
                material="chevron-left"
                taille={18}
                couleur={theme.heroTexteSecondaire}
              />
            </Pressable>
            <Text style={[styles.surtitre, { color: theme.voix }]}>{t('debat.titre')}</Text>
            <View style={[styles.jeton, { borderColor: theme.heroBordure }]}>
              <Icone sf="bolt.fill" material="bolt" taille={13} couleur={couleurs.or} />
              <Text style={[styles.jetonTexte, { color: theme.heroTexte }]}>
                {restantes === 0
                  ? t('debat.sessionAucuneCourt')
                  : restantes === 1
                    ? t('debat.sessionUneCourt')
                    : t('debat.sessionsCourt', { restantes })}
              </Text>
            </View>
          </View>

          <View style={styles.titres}>
            <Titre niveau="ecran">{t('debat.preparerTitre')}</Titre>
            <Text style={[typographie.corps, { color: theme.heroTexteSecondaire }]}>
              {t('debat.preparerCorps')}
            </Text>
          </View>

          {aReprendre ? (
            <View style={[styles.reprise, { borderColor: couleurs.or }]}>
              <Bulle taille="minuscule" visage="attend" calme />
              <View style={styles.repriseTexte}>
                <Text style={[typographie.corpsFort, { color: couleurs.blanc }]}>
                  {t('debat.repriseTitre')}
                </Text>
                <Text style={[typographie.petit, { color: theme.heroTexteSecondaire }]}>
                  {t('debat.repriseCorps')}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.replace(`/face-a-face/${aReprendre.id}`)}
                style={({ pressed }) => [styles.repriseBouton, pressed && styles.presse]}
              >
                <Text style={[styles.repriseLibelle, { color: couleurs.bleuNuit }]}>
                  {t('debat.reprendreCourt')}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {banqueVide ? (
            <View style={[styles.carteVide, { borderColor: theme.heroBordure }]}>
              <Text style={[typographie.corpsFort, { color: couleurs.blanc }]}>
                {t('debat.banqueVide')}
              </Text>
              <Text style={[typographie.petit, { color: theme.heroTexteSecondaire }]}>
                {t('debat.banqueVideCorps')}
              </Text>
            </View>
          ) : (
            <Text style={[styles.etiquette, { color: theme.heroTexteSecondaire }]}>
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
                style={({ pressed }) => [pressed && styles.presse]}
              >
                <View
                  style={[
                    styles.these,
                    {
                      borderColor: active ? couleurs.or : theme.heroBordure,
                      backgroundColor: active ? 'rgba(255, 189, 89, 0.10)' : 'transparent',
                    },
                  ]}
                >
                  <View style={styles.theseHaut}>
                    <View
                      style={[
                        styles.coche,
                        {
                          borderColor: active ? couleurs.or : theme.heroBordure,
                          backgroundColor: active ? couleurs.or : 'transparent',
                        },
                      ]}
                    >
                      {active ? (
                        <Icone
                          sf="checkmark"
                          material="check"
                          taille={12}
                          couleur={couleurs.bleuNuit}
                        />
                      ) : null}
                    </View>
                    <Text style={[styles.theseTexte, { color: couleurs.blanc }]}>
                      {these.texte}
                    </Text>
                  </View>
                  {active ? (
                    <View style={styles.tonBloc}>
                      <Text style={[styles.etiquette, { color: theme.heroTexteSecondaire }]}>
                        {t('debat.ton')}
                      </Text>
                      {rangeeTons(these)}
                    </View>
                  ) : null}
                </View>
              </Pressable>
            )
          })}

          {banqueVide ? null : (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: ecrireLaSienne }}
              onPress={() => {
                setEcrireLaSienne(true)
                setChoisie(null)
              }}
              style={({ pressed }) => [pressed && styles.presse]}
            >
              <View
                style={[
                  styles.sienne,
                  {
                    borderColor: ecrireVraiment ? couleurs.or : theme.heroBordure,
                    backgroundColor: ecrireVraiment ? 'rgba(255, 189, 89, 0.10)' : 'transparent',
                  },
                ]}
              >
                <Icone
                  sf="square.and.pencil"
                  material="edit"
                  taille={16}
                  couleur={ecrireVraiment ? couleurs.or : theme.heroTexteSecondaire}
                />
                <Text
                  style={[
                    typographie.corpsFort,
                    { color: ecrireVraiment ? couleurs.or : theme.heroTexteSecondaire },
                  ]}
                >
                  {t('debat.monSujet')}
                </Text>
              </View>
            </Pressable>
          )}

          {ecrireVraiment ? (
            <View style={[styles.champBloc, { borderColor: theme.heroBordure }]}>
              <Text style={[styles.etiquette, { color: theme.heroTexteSecondaire }]}>
                {t('debat.monSujetChamp')}
              </Text>
              <TextInput
                value={personnelle}
                onChangeText={setPersonnelle}
                multiline
                placeholder={t('debat.monSujetAide')}
                placeholderTextColor={theme.heroTexteSecondaire}
                style={[typographie.corps, styles.champ, { color: theme.heroTexte }]}
              />
              <Text style={[styles.etiquette, { color: theme.heroTexteSecondaire }]}>
                {t('debat.ton')}
              </Text>
              {rangeeTons(null)}
            </View>
          ) : null}
        </ScrollView>

        <View
          style={[
            styles.pied,
            { paddingBottom: insets.bottom + espaces.s, borderTopColor: theme.heroBordure },
          ]}
        >
          <Text style={[typographie.petit, styles.centre, { color: theme.heroTexteSecondaire }]}>
            {restantes === 0 ? t('debat.aucuneSession') : t('debat.duree', { minutes })}
          </Text>
          <Bouton
            libelle={t('debat.commencer')}
            chargement={envoi}
            desactive={!anonyme && (!pret || restantes <= 0)}
            onPress={() =>
              anonyme ? router.push(versCompte('debat')) : void commencer(aReprendre !== null)
            }
          />
          {anonyme ? <PorteCompte raison="debat" /> : null}
          <Text style={[typographie.petit, styles.centre, { color: theme.heroTexteSecondaire }]}>
            {t('debat.conservation')}
          </Text>
        </View>
      </View>
    </FondSombre>
  )
}

const styles = StyleSheet.create({
  ecran: { flex: 1 },
  contenu: { paddingHorizontal: espaces.l, gap: espaces.xs },
  entete: { flexDirection: 'row', alignItems: 'center', gap: espaces.s },
  retour: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  surtitre: {
    flex: 1,
    fontFamily: polices.extraBold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  jeton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: rayons.pilule,
    borderWidth: 1,
  },
  jetonTexte: { fontFamily: polices.bold, fontSize: 12, lineHeight: 16 },
  titres: { gap: espaces.xxs, paddingTop: espaces.m, paddingBottom: espaces.xs },
  etiquette: {
    fontFamily: polices.bold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  reprise: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaces.s,
    padding: espaces.s,
    borderRadius: rayons.l,
    borderWidth: 1.5,
    marginBottom: espaces.xs,
  },
  repriseTexte: { flex: 1, gap: 1 },
  repriseBouton: {
    paddingHorizontal: espaces.s,
    paddingVertical: espaces.xs,
    borderRadius: rayons.pilule,
    backgroundColor: couleurs.or,
  },
  repriseLibelle: { fontFamily: polices.extraBold, fontSize: 13, lineHeight: 17 },
  carteVide: {
    gap: espaces.xxs,
    padding: espaces.m,
    borderRadius: rayons.l,
    borderWidth: 1,
    marginBottom: espaces.xs,
  },
  these: {
    borderWidth: 1.5,
    borderRadius: rayons.l,
    paddingHorizontal: espaces.m,
    paddingVertical: espaces.s,
    gap: espaces.s,
  },
  theseHaut: { flexDirection: 'row', alignItems: 'flex-start', gap: espaces.s },
  coche: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  theseTexte: { flex: 1, fontFamily: polices.bold, fontSize: 15, lineHeight: 21 },
  tonBloc: { gap: espaces.xs, paddingLeft: 30 },
  tons: { flexDirection: 'row', flexWrap: 'wrap', gap: espaces.xs },
  pilule: {
    paddingHorizontal: espaces.s,
    paddingVertical: espaces.xs,
    borderRadius: rayons.pilule,
    borderWidth: 1,
  },
  sienne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaces.xs,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: rayons.l,
    paddingHorizontal: espaces.m,
    paddingVertical: espaces.s,
    marginTop: espaces.xxs,
  },
  champBloc: {
    borderWidth: 1,
    borderRadius: rayons.l,
    padding: espaces.m,
    gap: espaces.xs,
    marginTop: espaces.xxs,
  },
  champ: { minHeight: 64, textAlignVertical: 'top' },
  pied: {
    paddingHorizontal: espaces.l,
    paddingTop: espaces.s,
    gap: espaces.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  centre: { textAlign: 'center' },
  presse: { opacity: 0.85 },
})
