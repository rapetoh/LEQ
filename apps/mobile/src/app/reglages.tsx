import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { CODES_REGION, NOMS_REGION, type CodeRegion } from '@leq/domaine'

import { Bouton } from '@/components/ui/Bouton'
import { Carte } from '@/components/ui/Carte'
import { Icone } from '@/components/ui/Icone'
import { t } from '@/i18n/fr'
import { file } from '@/services/prises'
import {
  ErreurRecuperation,
  activerRecuperation,
  invaliderProgres,
  useSerie,
} from '@/services/progres'
import { supabase, useSession } from '@/services/supabase'
import { useContexteTheme, type ModeNuit } from '@/theme/ThemeProvider'
import { couleurs, espaces, polices, rayons, typographie } from '@/theme/tokens'

// G3 · Réglages et confidentialité, laid out as the mockup draws it: small section labels, one
// white card per section, rows of fifteen points, blue switches, and deleting the account as the
// last red row of the first card. The rule first, in plain words: the voice is not kept.

type Profil = {
  prenom: string | null
  region: CodeRegion | null
  publier_sous_prenom: boolean
  notif_rappel: boolean
  notif_serie: boolean
  notif_social: boolean
  notif_annonces: boolean
  heure_rappel: string
}

const CLE_PROFIL = ['profil'] as const

const MODES: { valeur: ModeNuit; libelle: string }[] = [
  { valeur: 'automatique', libelle: t('reglages.confort.automatique') },
  { valeur: 'clair', libelle: t('reglages.confort.clair') },
  { valeur: 'sombre', libelle: t('reglages.confort.sombre') },
]

function heureCourte(heure: string): string {
  const [h, m] = heure.split(':')
  return `${h ?? '21'} h ${m ?? '30'}`
}

export default function Reglages() {
  const { theme, mode, definirMode, animationsReduites, definirAnimationsReduites } =
    useContexteTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { session, reessayer } = useSession()
  const clientRequetes = useQueryClient()
  const mouvementReduit = useReducedMotion()
  const [message, setMessage] = useState<string | null>(null)
  const [suppression, setSuppression] = useState(false)
  const [choixRegion, setChoixRegion] = useState(false)
  const [heureSaisie, setHeureSaisie] = useState<string | null>(null)
  const serie = useSerie()

  const recuperation = useMutation({
    mutationFn: activerRecuperation,
    onSuccess: () => {
      setMessage(t('serie.couvert'))
      invaliderProgres(clientRequetes)
    },
    onError: (erreur: Error) => {
      const refus = erreur instanceof ErreurRecuperation ? erreur.refus : null
      setMessage(t(`serie.refus.${refus ?? 'inconnu'}`))
      invaliderProgres(clientRequetes)
    },
  })

  const utilisateurId = session?.user.id ?? null
  const anonyme = session?.user.is_anonymous === true

  const profil = useQuery({
    queryKey: CLE_PROFIL,
    enabled: utilisateurId !== null,
    queryFn: async (): Promise<Profil> => {
      const { data, error } = await supabase
        .from('profils')
        .select(
          'prenom, region, publier_sous_prenom, notif_rappel, notif_serie, notif_social, notif_annonces, heure_rappel',
        )
        .eq('id', utilisateurId)
        .single()
      if (error) throw new Error(error.message)
      return data as Profil
    },
  })

  const modifier = useMutation({
    mutationFn: async (champs: Partial<Profil>) => {
      const { error } = await supabase.from('profils').update(champs).eq('id', utilisateurId)
      if (error) throw new Error(error.message)
      return champs
    },
    onMutate: async (champs) => {
      await clientRequetes.cancelQueries({ queryKey: CLE_PROFIL })
      const precedent = clientRequetes.getQueryData<Profil>(CLE_PROFIL)
      if (precedent) clientRequetes.setQueryData<Profil>(CLE_PROFIL, { ...precedent, ...champs })
      return { precedent }
    },
    onError: (_erreur, _champs, contexte) => {
      if (contexte?.precedent) clientRequetes.setQueryData(CLE_PROFIL, contexte.precedent)
      setMessage(t('reglages.erreur'))
    },
    onSuccess: () => {
      setMessage(null)
      void clientRequetes.invalidateQueries({ queryKey: ['profil_rappels'] })
    },
  })

  const demanderExport = async () => {
    if (anonyme || !utilisateurId) {
      setMessage(t('reglages.voix.exportCompteRequis'))
      return
    }
    const { error } = await supabase
      .from('demandes_export')
      .insert({ utilisateur_id: utilisateurId, email: session?.user.email ?? null })
    setMessage(error ? t('reglages.erreur') : t('reglages.voix.exportEnvoye'))
  }

  const supprimerCompte = () => {
    Alert.alert(t('reglages.voix.supprimerTitre'), t('reglages.voix.supprimerTexte'), [
      { text: t('reglages.voix.supprimerAnnuler'), style: 'cancel' },
      {
        text: t('reglages.voix.supprimerConfirmer'),
        style: 'destructive',
        onPress: () => void executerSuppression(),
      },
    ])
  }

  const executerSuppression = async () => {
    setSuppression(true)
    try {
      const { error } = await supabase.rpc('demander_suppression_compte')
      if (error) throw new Error(error.message)
      // The server removes rows and audio; the phone forgets everything it held.
      for (const entree of file.lire()) {
        if (entree.chemin) await file.annuler(entree.id).catch(() => undefined)
      }
      await supabase.auth.signOut()
      await AsyncStorage.clear()
      clientRequetes.clear()
      reessayer()
      router.replace('/accueil/bienvenue')
    } catch (erreur) {
      console.warn('suppression: échec', erreur)
      setMessage(t('reglages.voix.supprimerErreur'))
    } finally {
      setSuppression(false)
    }
  }

  const ligne = (
    libelle: string,
    detail: string | null,
    droite: React.ReactNode,
    premiere = false,
    couleur?: string,
  ) => (
    <View
      style={[
        styles.ligne,
        !premiere && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.bordure },
      ]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.libelle, { color: couleur ?? theme.texte }]}>{libelle}</Text>
        {detail ? (
          <Text style={[styles.detail, { color: theme.texteSecondaire }]}>{detail}</Text>
        ) : null}
      </View>
      {droite}
    </View>
  )

  const interrupteur = (cle: keyof Profil, valeur: boolean) => (
    <Switch
      value={valeur}
      onValueChange={(v) => modifier.mutate({ [cle]: v })}
      trackColor={{ true: theme.lien }}
      accessibilityLabel={String(cle)}
    />
  )

  const lien = (libelle: string, onPress: () => void, chargement = false) => (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={chargement}
      hitSlop={8}
      style={({ pressed }) => [pressed && styles.presse]}
    >
      <Text style={[styles.lien, { color: theme.lien }]}>{libelle}</Text>
    </Pressable>
  )

  const chevron = (couleur?: string) => (
    <Icone
      sf="chevron.right"
      material="chevron-right"
      taille={16}
      couleur={couleur ?? theme.texteTertiaire}
    />
  )

  const p = profil.data

  return (
    <ScrollView
      style={{ backgroundColor: theme.fond }}
      contentContainerStyle={[
        styles.contenu,
        { paddingTop: insets.top + espaces.s, paddingBottom: insets.bottom + espaces.xxl },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('commun.retour')}
        onPress={() => router.back()}
        hitSlop={12}
        style={[styles.retour, { backgroundColor: theme.carte }]}
      >
        <Icone sf="chevron.left" material="chevron-left" taille={18} couleur={theme.texte} />
      </Pressable>
      <Text style={[styles.titre, { color: theme.texte }]}>{t('reglages.titre')}</Text>

      <View style={styles.section}>
        <Text style={[styles.etiquette, { color: theme.texteSecondaire }]}>
          {t('reglages.voix.titre')}
        </Text>
        <Carte style={styles.liste}>
          <View style={[styles.ligne, { flexDirection: 'column', alignItems: 'stretch', gap: 3 }]}>
            <Text style={[styles.libelle, { color: theme.texte }]}>
              {t('reglages.voix.sousTitre')}
            </Text>
            <Text style={[styles.detail, { color: theme.texteSecondaire }]}>
              {t('reglages.voix.texte')}
            </Text>
          </View>
          {ligne(
            t('reglages.voix.publierPrenom'),
            t('reglages.voix.publierPrenomDetail'),
            p ? interrupteur('publier_sous_prenom', p.publier_sous_prenom) : null,
          )}
          <Pressable
            accessibilityRole="button"
            onPress={() => void demanderExport()}
            style={({ pressed }) => [pressed && styles.presse]}
          >
            {ligne(t('reglages.voix.export'), null, chevron())}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={supprimerCompte}
            disabled={suppression}
            style={({ pressed }) => [pressed && styles.presse]}
          >
            {ligne(
              t('reglages.voix.supprimer'),
              null,
              chevron(couleurs.rouge),
              false,
              couleurs.rouge,
            )}
          </Pressable>
        </Carte>
      </View>

      <View style={styles.section}>
        <Text style={[styles.etiquette, { color: theme.texteSecondaire }]}>
          {t('reglages.rituel.titre')}
        </Text>
        <Carte style={styles.liste}>
          {ligne(
            t('reglages.rituel.rappel'),
            p ? t('reglages.rituel.rappelHeure', { heure: heureCourte(p.heure_rappel) }) : null,
            p ? (
              <View style={styles.ligneCourte}>
                {lien(t('reglages.rituel.modifier'), () =>
                  setHeureSaisie(heureSaisie === null ? p.heure_rappel.slice(0, 5) : null),
                )}
                {interrupteur('notif_rappel', p.notif_rappel)}
              </View>
            ) : null,
            true,
          )}
          {heureSaisie !== null ? (
            <View
              style={[
                styles.ligne,
                { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.bordure },
              ]}
            >
              <TextInput
                accessibilityLabel={t('reglages.rituel.heure')}
                value={heureSaisie}
                onChangeText={setHeureSaisie}
                keyboardType="numbers-and-punctuation"
                placeholder="21:30"
                placeholderTextColor={theme.texteTertiaire}
                style={[
                  typographie.corps,
                  styles.champHeure,
                  { color: theme.texte, borderColor: theme.bordure },
                ]}
              />
              <Bouton
                libelle={t('reglages.rituel.enregistrerHeure')}
                variante="secondaire"
                desactive={!/^([01]\d|2[0-3]):[0-5]\d$/.test(heureSaisie)}
                onPress={() => {
                  modifier.mutate({ heure_rappel: heureSaisie })
                  setHeureSaisie(null)
                }}
              />
            </View>
          ) : null}
          {ligne(
            t('reglages.rituel.serie'),
            t('reglages.rituel.serieDetail'),
            p ? interrupteur('notif_serie', p.notif_serie) : null,
          )}
          {ligne(
            t('reglages.rituel.social'),
            t('reglages.rituel.socialDetail'),
            p ? interrupteur('notif_social', p.notif_social) : null,
          )}
          {ligne(
            t('reglages.rituel.annonces'),
            t('reglages.rituel.annoncesDetail'),
            p ? interrupteur('notif_annonces', p.notif_annonces) : null,
          )}
          {ligne(
            t('serie.proteger'),
            serie.data
              ? serie.data.recuperation.restantes === 0
                ? t('serie.detailAucune')
                : serie.data.recuperation.restantes === 1
                  ? t('serie.detail', { restantes: 1 })
                  : t('serie.detailPlusieurs', { restantes: serie.data.recuperation.restantes })
              : null,
            serie.data?.recuperation.jour_a_couvrir
              ? lien(t('serie.activer'), () => recuperation.mutate(), recuperation.isPending)
              : null,
          )}
          {serie.data && !serie.data.recuperation.jour_a_couvrir ? (
            <Text style={[styles.detail, styles.sousLigne, { color: theme.texteTertiaire }]}>
              {serie.data.recuperation.jour_reparable && serie.data.recuperation.restantes === 0
                ? t('serie.quotaUtilise', { record: serie.data.record })
                : serie.data.courante > 0
                  ? t('serie.rienACouvrir')
                  : t('serie.tropTard', { record: serie.data.record })}
            </Text>
          ) : null}
        </Carte>
        <Text style={[styles.detail, { color: theme.texteTertiaire }]}>
          {t('reglages.rituel.noteRappels')}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.etiquette, { color: theme.texteSecondaire }]}>
          {t('reglages.region.titre')}
        </Text>
        <Carte style={styles.liste}>
          {ligne(
            p?.region ? NOMS_REGION[p.region] : t('reglages.region.aucune'),
            t('reglages.region.detail'),
            lien(t('reglages.region.choisir'), () => setChoixRegion((v) => !v)),
            true,
          )}
          {choixRegion
            ? CODES_REGION.map((code) => (
                <Pressable
                  key={code}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: p?.region === code }}
                  onPress={() => {
                    modifier.mutate({ region: code })
                    setChoixRegion(false)
                  }}
                  style={[
                    styles.ligne,
                    { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.bordure },
                  ]}
                >
                  <Text
                    style={[
                      styles.libelle,
                      { color: p?.region === code ? theme.texte : theme.texteSecondaire, flex: 1 },
                    ]}
                  >
                    {NOMS_REGION[code]}
                  </Text>
                  {p?.region === code ? (
                    <Icone sf="checkmark" material="check" taille={16} couleur={theme.lien} />
                  ) : null}
                </Pressable>
              ))
            : null}
        </Carte>
      </View>

      <View style={styles.section}>
        <Text style={[styles.etiquette, { color: theme.texteSecondaire }]}>
          {t('reglages.confort.titre')}
        </Text>
        <Carte style={styles.liste}>
          <View style={[styles.ligne, { flexDirection: 'column', alignItems: 'stretch', gap: 10 }]}>
            <Text style={[styles.libelle, { color: theme.texte }]}>
              {t('reglages.confort.modeNuit')}
            </Text>
            <View style={[styles.segments, { backgroundColor: theme.carteDouce }]}>
              {MODES.map((option) => {
                const actif = option.valeur === mode
                return (
                  <Pressable
                    key={option.valeur}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: actif }}
                    onPress={() => definirMode(option.valeur)}
                    style={[
                      styles.segment,
                      actif && { backgroundColor: theme.sombre ? theme.carte : couleurs.bleuNuit },
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentTexte,
                        { color: actif ? couleurs.blanc : theme.texteSecondaire },
                      ]}
                    >
                      {option.libelle}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
          {ligne(
            t('reglages.confort.animations'),
            mouvementReduit
              ? t('reglages.confort.animationsDetail')
              : t('moi.reduireAnimationsSysteme'),
            <Switch
              value={animationsReduites || mouvementReduit}
              disabled={mouvementReduit}
              onValueChange={definirAnimationsReduites}
              trackColor={{ true: theme.lien }}
              accessibilityLabel={t('reglages.confort.animations')}
            />,
          )}
        </Carte>
      </View>

      {message ? (
        <Text style={[typographie.petit, styles.message, { color: theme.texteSecondaire }]}>
          {message}
        </Text>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  contenu: { paddingHorizontal: espaces.xl, gap: espaces.l },
  presse: { opacity: 0.8 },
  retour: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titre: {
    fontFamily: polices.extraBold,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.85,
    marginTop: -espaces.xs,
  },
  section: { gap: 10 },
  etiquette: {
    fontFamily: polices.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  liste: { paddingVertical: 6, paddingHorizontal: espaces.l },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espaces.s, paddingVertical: 15 },
  libelle: { fontFamily: polices.bold, fontSize: 15, lineHeight: 20 },
  detail: { fontFamily: polices.medium, fontSize: 12.5, lineHeight: 18 },
  lien: { fontFamily: polices.bold, fontSize: 13, lineHeight: 18 },
  segments: { flexDirection: 'row', padding: 3, borderRadius: rayons.pilule },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: espaces.xs,
    borderRadius: rayons.pilule,
  },
  segmentTexte: { fontFamily: polices.bold, fontSize: 13, lineHeight: 18 },
  message: { textAlign: 'center' },
  ligneCourte: { flexDirection: 'row', alignItems: 'center', gap: espaces.s },
  champHeure: {
    flex: 1,
    borderWidth: 1,
    borderRadius: rayons.s,
    paddingHorizontal: espaces.s,
    paddingVertical: espaces.xs,
  },
  sousLigne: { paddingBottom: espaces.m },
})
