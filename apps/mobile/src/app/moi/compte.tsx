import { PrenomSchema } from '@leq/domaine'
import { useQueryClient } from '@tanstack/react-query'
import { Redirect, useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Avatar } from '@/components/Avatar'
import { Bouton } from '@/components/ui/Bouton'
import { Carte } from '@/components/ui/Carte'
import { Icone } from '@/components/ui/Icone'
import { LogoApple, LogoGoogle } from '@/components/ui/Logos'
import { t } from '@/i18n/fr'
import { seDeconnecter, supprimerCompteEtToutOublier } from '@/services/compte'
import { nomFormule, useFormules } from '@/services/formules'
import {
  adresseMasquee,
  CLE_PROFIL_LECTURE,
  fournisseurDeConnexion,
  moisEtAnnee,
  useProfil,
} from '@/services/profil'
import { usePoints, useSerie } from '@/services/progres'
import { supabase, useSession } from '@/services/supabase'
import { useTheme } from '@/theme/ThemeProvider'
import { couleurs, espaces, polices, rayons, typographie } from '@/theme/tokens'

// Mon compte: who the person is to the application, and the gestures on it. The first name
// they are greeted by, how they signed in, what their tier gives, and at the very end, leaving
// or deleting. Reached from the card at the top of Moi.

export default function MonCompte() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const clientRequetes = useQueryClient()
  const { session, reessayer } = useSession()
  const profil = useProfil()
  const points = usePoints()
  const serie = useSerie()
  const formules = useFormules()
  // What the person typed, or nothing yet: the field shows the saved name until then.
  const [brouillon, setBrouillon] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  if (session?.user.is_anonymous) return <Redirect href="/accueil/compte" />

  const prenomEnregistre = profil.data?.prenom?.trim() ?? ''
  const prenom = brouillon ?? prenomEnregistre
  const prenomChange = prenom.trim() !== prenomEnregistre
  const prenomValide = PrenomSchema.safeParse(prenom.trim()).success
  const fournisseur = fournisseurDeConnexion(session)
  const email = session?.user.email ?? null
  const formule = points.data
    ? ((formules.data ?? []).find((f) => f.cle === points.data.formule) ?? null)
    : null

  const enregistrerPrenom = async () => {
    const id = session?.user.id
    if (!id || !prenomValide) return
    setEnCours(true)
    setMessage(null)
    const { error } = await supabase.from('profils').update({ prenom: prenom.trim() }).eq('id', id)
    setEnCours(false)
    if (error) {
      setMessage(t('moi.monCompte.erreur'))
      return
    }
    void clientRequetes.invalidateQueries({ queryKey: CLE_PROFIL_LECTURE })
    setBrouillon(null)
    setMessage(t('moi.monCompte.enregistre'))
  }

  const deconnecter = async () => {
    await seDeconnecter(clientRequetes)
    reessayer()
    router.replace('/accueil/bienvenue')
  }

  const supprimer = () => {
    Alert.alert(t('reglages.voix.supprimerTitre'), t('reglages.voix.supprimerTexte'), [
      { text: t('reglages.voix.supprimerAnnuler'), style: 'cancel' },
      {
        text: t('reglages.voix.supprimerConfirmer'),
        style: 'destructive',
        onPress: () => {
          setEnCours(true)
          supprimerCompteEtToutOublier(clientRequetes)
            .then(() => {
              reessayer()
              router.replace('/accueil/bienvenue')
            })
            .catch(() => setMessage(t('reglages.voix.supprimerErreur')))
            .finally(() => setEnCours(false))
        },
      },
    ])
  }

  const droits = formule
    ? [
        formule.etapes_par_jour === 0
          ? t('moi.monCompte.etapesSansLimite')
          : formule.etapes_par_jour === 1
            ? t('moi.monCompte.etapeParJour')
            : t('moi.monCompte.etapesParJour', { n: formule.etapes_par_jour }),
        formule.debats_par_mois === 0
          ? t('moi.monCompte.debatsAucun')
          : formule.debats_par_mois === 1
            ? t('moi.monCompte.debatParMois')
            : t('moi.monCompte.debatsParMois', { n: formule.debats_par_mois }),
        ...(formule.debats_par_mois > 0
          ? [t('moi.monCompte.dureeDebat', { min: Math.round(formule.duree_debat_s / 60) })]
          : []),
      ]
    : []

  return (
    <ScrollView
      style={{ backgroundColor: theme.fond }}
      contentContainerStyle={[
        styles.contenu,
        { paddingTop: insets.top + espaces.s, paddingBottom: insets.bottom + espaces.xl },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.barre}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('commun.retour')}
          onPress={() => router.back()}
          hitSlop={12}
          style={[styles.retour, { backgroundColor: theme.carte }]}
        >
          <Icone sf="chevron.left" material="chevron-left" taille={18} couleur={theme.texte} />
        </Pressable>
        <Text style={[styles.titre, { color: theme.texte }]}>{t('moi.monCompte.titre')}</Text>
        <View style={styles.retour} />
      </View>

      <View style={styles.entete}>
        <Avatar
          prenom={prenomEnregistre || null}
          taille={88}
          flamme={(serie.data?.courante ?? 0) > 0}
        />
        {profil.data ? (
          <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>
            {t('moi.depuis', { mois: moisEtAnnee(profil.data.cree_le) })}
          </Text>
        ) : null}
      </View>

      <Section titre={t('moi.monCompte.prenom')}>
        <Carte style={styles.carte}>
          <View style={styles.champLigne}>
            <TextInput
              style={[styles.champ, { color: theme.texte }]}
              value={prenom}
              onChangeText={(v) => {
                setBrouillon(v)
                setMessage(null)
              }}
              autoComplete="given-name"
              textContentType="givenName"
              returnKeyType="done"
              onSubmitEditing={() => void enregistrerPrenom()}
            />
            {prenomChange ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void enregistrerPrenom()}
                disabled={!prenomValide || enCours}
                hitSlop={8}
              >
                <Text
                  style={[
                    styles.action,
                    { color: prenomValide ? theme.lien : theme.texteTertiaire },
                  ]}
                >
                  {t('moi.monCompte.enregistrer')}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={[typographie.petit, styles.aide, { color: theme.texteTertiaire }]}>
            {t('compte.prenomAide')}
          </Text>
        </Carte>
      </Section>

      <Section titre={t('moi.monCompte.connexion')}>
        <Carte style={styles.carte}>
          <View style={styles.ligne}>
            <View
              style={[
                styles.pastille,
                { backgroundColor: theme.sombre ? theme.carteDouce : couleurs.neutreDoux },
              ]}
            >
              {fournisseur === 'apple' ? (
                <LogoApple taille={16} couleur={theme.texte} />
              ) : fournisseur === 'google' ? (
                <LogoGoogle taille={16} />
              ) : (
                <Icone sf="envelope.fill" material="mail" taille={16} couleur={theme.texte} />
              )}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.ligneLibelle, { color: theme.texte }]}>
                {fournisseur === 'apple'
                  ? t('moi.monCompte.avecApple')
                  : fournisseur === 'google'
                    ? t('moi.monCompte.avecGoogle')
                    : t('moi.monCompte.avecEmail')}
              </Text>
              {email ? (
                <Text
                  style={[typographie.petit, { color: theme.texteSecondaire }]}
                  numberOfLines={1}
                >
                  {adresseMasquee(email) ? t('moi.monCompte.adresseMasquee') : email}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={[styles.filet, { backgroundColor: theme.bordure }]} />
          <Pressable
            accessibilityRole="button"
            onPress={() => void deconnecter()}
            disabled={enCours}
            style={styles.ligne}
          >
            <Text style={[styles.ligneLibelle, { color: theme.lien, flex: 1 }]}>
              {t('moi.compte.deconnexion')}
            </Text>
            <Icone
              sf="chevron.right"
              material="chevron-right"
              taille={16}
              couleur={theme.texteTertiaire}
            />
          </Pressable>
        </Carte>
      </Section>

      {formule ? (
        <Section titre={t('moi.monCompte.formule')}>
          <Carte style={styles.carte}>
            <View style={styles.ligne}>
              <View
                style={[
                  styles.pastille,
                  { backgroundColor: theme.sombre ? theme.carteDouce : couleurs.vertDoux },
                ]}
              >
                <Icone
                  sf="checkmark.seal.fill"
                  material="verified"
                  taille={16}
                  couleur={couleurs.vert}
                />
              </View>
              <Text style={[styles.ligneLibelle, { color: theme.texte, flex: 1 }]}>
                {nomFormule(formules.data, formule.cle)}
              </Text>
            </View>
            <View style={[styles.filet, { backgroundColor: theme.bordure }]} />
            <View style={styles.droits}>
              {droits.map((droit) => (
                <View key={droit} style={styles.droit}>
                  <Icone sf="checkmark" material="check" taille={14} couleur={couleurs.vert} />
                  <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>{droit}</Text>
                </View>
              ))}
            </View>
          </Carte>
        </Section>
      ) : null}

      <Section titre={t('moi.monCompte.donnees')}>
        <Carte style={styles.carte}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/reglages')}
            style={styles.ligne}
          >
            <Text style={[styles.ligneLibelle, { color: theme.texte, flex: 1 }]}>
              {t('moi.reglages')}
            </Text>
            <Icone
              sf="chevron.right"
              material="chevron-right"
              taille={16}
              couleur={theme.texteTertiaire}
            />
          </Pressable>
          <View style={[styles.filet, { backgroundColor: theme.bordure }]} />
          <Pressable
            accessibilityRole="button"
            onPress={supprimer}
            disabled={enCours}
            style={styles.ligne}
          >
            <Text style={[styles.ligneLibelle, { color: couleurs.rouge, flex: 1 }]}>
              {t('reglages.voix.supprimer')}
            </Text>
            <Icone
              sf="chevron.right"
              material="chevron-right"
              taille={16}
              couleur={couleurs.rouge}
            />
          </Pressable>
        </Carte>
      </Section>

      {message ? (
        <Text style={[typographie.petit, styles.message, { color: theme.texteSecondaire }]}>
          {message}
        </Text>
      ) : null}
      {enCours ? (
        <Bouton
          libelle={t('commun.chargement')}
          variante="texte"
          chargement
          onPress={() => undefined}
        />
      ) : null}
    </ScrollView>
  )
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  const theme = useTheme()
  return (
    <View style={styles.section}>
      <Text style={[styles.etiquette, { color: theme.texteSecondaire }]}>
        {titre.toUpperCase()}
      </Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  contenu: { paddingHorizontal: espaces.xl, gap: espaces.l },
  barre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  retour: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titre: { fontFamily: polices.extraBold, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  entete: { alignItems: 'center', gap: espaces.s },
  section: { gap: 10 },
  etiquette: { fontFamily: polices.bold, fontSize: 11, lineHeight: 14, letterSpacing: 1.1 },
  carte: { paddingVertical: 6, paddingHorizontal: espaces.l, gap: 0 },
  champLigne: { flexDirection: 'row', alignItems: 'center', gap: espaces.s, paddingVertical: 6 },
  champ: {
    flex: 1,
    fontFamily: polices.bold,
    fontSize: 17,
    lineHeight: 22,
    paddingVertical: espaces.xs,
  },
  action: { fontFamily: polices.bold, fontSize: 14, lineHeight: 18 },
  aide: { paddingBottom: espaces.s },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15 },
  ligneLibelle: { fontFamily: polices.bold, fontSize: 15, lineHeight: 20 },
  pastille: {
    width: 34,
    height: 34,
    borderRadius: rayons.s,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filet: { height: StyleSheet.hairlineWidth },
  droits: { gap: espaces.xs, paddingVertical: espaces.s },
  droit: { flexDirection: 'row', alignItems: 'center', gap: espaces.xs },
  message: { textAlign: 'center' },
})
