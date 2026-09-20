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
import { EcranChargement, EcranErreur } from '@/components/EcransEtat'
import { MarqueRetor } from '@/components/MarqueRetor'
import { PorteCompte } from '@/components/PorteCompte'
import { Bouton } from '@/components/ui/Bouton'
import { Icone } from '@/components/ui/Icone'
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
import { nomFormule, useFormules } from '@/services/formules'
import { compter } from '@/services/usage'
import { FondSombre } from '@/theme/FondSombre'
import { useTheme } from '@/theme/ThemeProvider'
import { couleurs, espaces, polices, rayons, typographie } from '@/theme/tokens'

// E2 · Préparer le face-à-face.
//
// The screen carries one decision and two settings, in that order, and nothing else. The
// decision is the thesis: one at a time, in full, in quotes, because a person reads a thesis to
// know whether they can argue against it, and three side by side is a list to skim rather than
// a sentence to weigh. The settings are Rétor's, and they sit with him: his tone, said in his
// own words, and his voice.
//
// Everything on it is real. There is no theme on a thesis in the database, so no theme filter;
// a debate pays no points, so no points; turns are not capped, so no turn count. A number
// nobody computes is worse than no number: the person believes it.

const TONS = ['ferme', 'provocateur', 'academique', 'bienveillant'] as const
type Ton = (typeof TONS)[number]

const LIBELLE_TON: Record<Ton, Parameters<typeof t>[0]> = {
  ferme: 'debat.tonFerme',
  provocateur: 'debat.tonProvocateur',
  academique: 'debat.tonAcademique',
  bienveillant: 'debat.tonBienveillant',
}

/** What each tone actually changes, in the words the server sends to Rétor. */
const DETAIL_TON: Record<Ton, Parameters<typeof t>[0]> = {
  ferme: 'debat.tonFermeDetail',
  provocateur: 'debat.tonProvocateurDetail',
  academique: 'debat.tonAcademiqueDetail',
  bienveillant: 'debat.tonBienveillantDetail',
}

const VOIX = ['homme', 'femme'] as const
type Voix = (typeof VOIX)[number]

const LIBELLE_VOIX: Record<Voix, Parameters<typeof t>[0]> = {
  homme: 'debat.voixHomme',
  femme: 'debat.voixFemme',
}

/** Enough of the bank to choose from without asking for it again. */
const THESES_CHARGEES = 12

export default function PreparerDebat() {
  const theme = useTheme()
  useBarreEtatClaire()
  const { enCours: actualisation, actualiser } = useActualisation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const clientRequetes = useQueryClient()
  const theses = useTheses(THESES_CHARGEES)
  const quota = useQuotaDebats()
  const reprise = useDebatAReprendre()
  const configuration = useConfiguration()
  const formules = useFormules()
  const anonyme = useEstAnonyme()

  /** Which thesis of the bank is on screen. */
  const [rang, setRang] = useState(0)
  const [personnelle, setPersonnelle] = useState('')
  const [ecrireLaSienne, setEcrireLaSienne] = useState(false)
  const [ton, setTon] = useState<Ton | null>(null)
  const [voix, setVoix] = useState<Voix>('homme')
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

  const banque = theses.data ?? []
  const restantes = quota.data?.restants ?? 0
  const aReprendre = reprise.data ?? null
  // With no bank there is only one way in, so the screen opens it rather than asking twice.
  const ecrireVraiment = ecrireLaSienne || banque.length === 0
  const choisie: These | null = ecrireVraiment ? null : (banque[rang % banque.length] ?? null)
  const tonEffectif: Ton = ton ?? (choisie?.ton_suggere as Ton | undefined) ?? 'ferme'
  const secondes =
    quota.data?.formule === 'gratuit'
      ? (configuration.data?.duree_face_a_face_gratuit_s ?? 180)
      : (configuration.data?.duree_face_a_face_complet_s ?? 480)
  const minutes = Math.max(1, Math.round(secondes / 60))
  const formule = nomFormule(formules.data, quota.data?.formule ?? 'gratuit')
  const pret = ecrireVraiment ? personnelle.trim().length > 0 : choisie !== null

  const commencer = async (abandonnerLAutre = false) => {
    setEnvoi(true)
    try {
      if (abandonnerLAutre) await abandonnerDebat()
      const debat = await ouvrirDebat({
        theseId: ecrireVraiment ? null : (choisie?.id ?? null),
        theseTexte: ecrireVraiment ? personnelle.trim() : null,
        ton: tonEffectif,
        voix,
      })
      invaliderDebats(clientRequetes)
      compter('debat_ouvert', { ton: tonEffectif, voix, these_personnelle: ecrireVraiment })
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
            { paddingTop: insets.top + espaces.m, paddingBottom: espaces.l },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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

          {/* The promise is Rétor's card's job, one screen down: saying it twice is the failure
              docs/STRINGS.md calls reviewing the screen rather than the string. */}
          <Text style={[styles.titre, { color: couleurs.blanc }]}>{t('debat.preparerTitre')}</Text>

          {aReprendre ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace(`/face-a-face/${aReprendre.id}`)}
              style={({ pressed }) => [pressed && styles.presse]}
            >
              <View style={[styles.reprise, { borderColor: couleurs.or }]}>
                <View style={styles.repriseTexte}>
                  <Text style={[typographie.corpsFort, { color: couleurs.blanc }]}>
                    {t('debat.repriseTitre')}
                  </Text>
                  <Text style={[typographie.petit, { color: theme.heroTexteSecondaire }]}>
                    {t('debat.repriseCorps')}
                  </Text>
                </View>
                <Icone
                  sf="arrow.right"
                  material="arrow-forward"
                  taille={18}
                  couleur={couleurs.or}
                />
              </View>
            </Pressable>
          ) : null}

          {/* The decision: one thesis, read in full. */}
          <Text style={[styles.etiquette, { color: theme.heroTexteSecondaire }]}>
            {ecrireVraiment ? t('debat.monSujetChamp') : t('debat.theseQuIlDefend')}
          </Text>

          {ecrireVraiment ? (
            <View style={[styles.carteThese, { borderColor: couleurs.or }]}>
              <TextInput
                value={personnelle}
                onChangeText={setPersonnelle}
                multiline
                autoFocus={banque.length > 0}
                placeholder={t('debat.monSujetAide')}
                placeholderTextColor={theme.heroTexteSecondaire}
                style={[styles.theseTexte, styles.champ, { color: couleurs.blanc }]}
              />
              {banque.length > 0 ? (
                <View style={styles.actionsThese}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setEcrireLaSienne(false)}
                    style={({ pressed }) => [styles.actionThese, pressed && styles.presse]}
                  >
                    <Icone
                      sf="tray.full"
                      material="inbox"
                      taille={15}
                      couleur={theme.heroTexteSecondaire}
                    />
                    <Text style={[styles.actionTexte, { color: theme.heroTexteSecondaire }]}>
                      {t('debat.revenirBanque')}
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <Text style={[typographie.petit, { color: theme.heroTexteSecondaire }]}>
                  {t('debat.banqueVideCorps')}
                </Text>
              )}
            </View>
          ) : (
            <View style={[styles.carteThese, { borderColor: theme.heroBordure }]}>
              <Text style={[styles.theseTexte, { color: couleurs.blanc }]}>
                {`« ${choisie?.texte ?? ''} »`}
              </Text>
              <View style={[styles.actionsThese, { borderTopColor: theme.heroBordure }]}>
                <Pressable
                  accessibilityRole="button"
                  disabled={banque.length < 2}
                  onPress={() => {
                    setRang((precedent) => precedent + 1)
                    setTon(null)
                  }}
                  style={({ pressed }) => [styles.actionThese, pressed && styles.presse]}
                >
                  <Icone
                    sf="arrow.triangle.2.circlepath"
                    material="autorenew"
                    taille={15}
                    couleur={banque.length < 2 ? theme.heroTexteSecondaire : couleurs.or}
                  />
                  <Text
                    style={[
                      styles.actionTexte,
                      { color: banque.length < 2 ? theme.heroTexteSecondaire : couleurs.or },
                    ]}
                  >
                    {t('debat.uneAutre')}
                  </Text>
                </Pressable>
                <View style={[styles.separateur, { backgroundColor: theme.heroBordure }]} />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setEcrireLaSienne(true)}
                  style={({ pressed }) => [styles.actionThese, pressed && styles.presse]}
                >
                  <Icone
                    sf="square.and.pencil"
                    material="edit"
                    taille={15}
                    couleur={theme.heroTexteSecondaire}
                  />
                  <Text style={[styles.actionTexte, { color: theme.heroTexteSecondaire }]}>
                    {t('debat.monSujet')}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Rétor, and the two things about him the person decides. */}
          <View style={[styles.carteRetor, { borderColor: theme.heroBordure }]}>
            <View style={styles.retorHaut}>
              <MarqueRetor taille={44} />
              <View style={styles.retorNoms}>
                <Text style={[styles.etiquette, { color: theme.voix }]}>
                  {t('debat.contradicteur')}
                </Text>
                <Text style={[styles.retorNom, { color: couleurs.blanc }]}>{t('debat.retor')}</Text>
              </View>
            </View>
            <Text style={[typographie.petit, { color: theme.heroTexteSecondaire }]}>
              {t('debat.retorQuiEst')}
            </Text>

            <View style={[styles.reglage, { borderTopColor: theme.heroBordure }]}>
              <Text style={[styles.etiquette, { color: theme.heroTexteSecondaire }]}>
                {t('debat.ton')}
              </Text>
              <View style={styles.pilules}>
                {TONS.map((cle) => {
                  const actif = tonEffectif === cle
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
                          styles.piluleTexte,
                          { color: actif ? couleurs.bleuNuit : theme.heroTexteSecondaire },
                        ]}
                      >
                        {t(LIBELLE_TON[cle])}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
              <Text style={[typographie.petit, styles.detail, { color: couleurs.encre3 }]}>
                {t(DETAIL_TON[tonEffectif])}
              </Text>
            </View>

            <View style={[styles.reglage, { borderTopColor: theme.heroBordure }]}>
              <Text style={[styles.etiquette, { color: theme.heroTexteSecondaire }]}>
                {t('debat.voix')}
              </Text>
              <View style={styles.pilules}>
                {VOIX.map((cle) => {
                  const actif = voix === cle
                  return (
                    <Pressable
                      key={cle}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: actif }}
                      onPress={() => setVoix(cle)}
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
                          styles.piluleTexte,
                          { color: actif ? couleurs.bleuNuit : theme.heroTexteSecondaire },
                        ]}
                      >
                        {t(LIBELLE_VOIX[cle])}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>
          </View>
        </ScrollView>

        <View
          style={[
            styles.pied,
            { paddingBottom: insets.bottom + espaces.s, borderTopColor: theme.heroBordure },
          ]}
        >
          <Text style={[typographie.petit, styles.centre, { color: theme.heroTexteSecondaire }]}>
            {restantes === 0
              ? t('debat.aucuneSession')
              : t('debat.dureeEtFormule', { minutes, formule })}
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
  titre: {
    fontFamily: polices.extraBold,
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.5,
    paddingTop: espaces.s,
    paddingBottom: espaces.xs,
  },
  etiquette: {
    fontFamily: polices.bold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.9,
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
  carteThese: {
    borderWidth: 1.5,
    borderRadius: rayons.xl,
    paddingHorizontal: espaces.m,
    paddingTop: espaces.m,
    gap: espaces.s,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  theseTexte: { fontFamily: polices.bold, fontSize: 18, lineHeight: 25 },
  champ: { minHeight: 78, textAlignVertical: 'top' },
  actionsThese: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginHorizontal: -espaces.m,
    paddingHorizontal: espaces.xs,
  },
  actionThese: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: espaces.s,
  },
  actionTexte: { fontFamily: polices.bold, fontSize: 13, lineHeight: 18 },
  separateur: { width: StyleSheet.hairlineWidth, height: 20 },
  carteRetor: {
    marginTop: espaces.xs,
    borderWidth: 1,
    borderRadius: rayons.xl,
    padding: espaces.m,
    gap: espaces.xs,
  },
  retorHaut: { flexDirection: 'row', alignItems: 'center', gap: espaces.s },
  retorNoms: { gap: 1 },
  retorNom: { fontFamily: polices.extraBold, fontSize: 18, lineHeight: 23 },
  reglage: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: espaces.s,
    marginTop: espaces.xs,
    gap: espaces.xs,
  },
  pilules: { flexDirection: 'row', flexWrap: 'wrap', gap: espaces.xs },
  pilule: {
    paddingHorizontal: espaces.s,
    paddingVertical: 7,
    borderRadius: rayons.pilule,
    borderWidth: 1,
  },
  piluleTexte: { fontFamily: polices.bold, fontSize: 13, lineHeight: 17 },
  detail: { fontStyle: 'italic' },
  pied: {
    paddingHorizontal: espaces.l,
    paddingTop: espaces.s,
    gap: espaces.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  centre: { textAlign: 'center' },
  presse: { opacity: 0.85 },
})
