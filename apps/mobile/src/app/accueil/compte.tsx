import { PrenomSchema, type Mesures } from '@leq/domaine'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Bulle } from '@/components/Bulle'
import { Bouton } from '@/components/ui/Bouton'
import { Degrade } from '@/components/ui/Degrade'
import { LogoApple, LogoGoogle } from '@/components/ui/Logos'
import { t } from '@/i18n/fr'
import { useDemarrage } from '@/services/configuration'
import {
  ErreurIdentite,
  fournisseurDisponible,
  seConnecterAvec,
  type Fournisseur,
} from '@/services/identite'
import { lireProfilLocal } from '@/services/profilLocal'
import { supabase } from '@/services/supabase'
import { compter } from '@/services/usage'
import { useTheme } from '@/theme/ThemeProvider'
import { couleurs, espaces, polices, rayons, typographie } from '@/theme/tokens'

// A7 · Garder son profil, as the mockup draws it: the profile the person just earned, held in a
// bleu nuit card, one line, and the doors. Apple and Google through the system sheet, e-mail
// through a six-digit code. Refusing keeps everything on the phone.

type Etape = 'choix' | 'email' | 'code' | 'prenom'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const NOMS: Record<Fournisseur, string> = { apple: 'Apple', google: 'Google' }

export default function Compte() {
  const params = useLocalSearchParams<{ mode?: string }>()
  const connexion = params.mode === 'connexion'
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { marquerAccueilTermine } = useDemarrage()
  const [etape, setEtape] = useState<Etape>('choix')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [prenom, setPrenom] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [fournisseurEnCours, setFournisseurEnCours] = useState<Fournisseur | null>(null)
  const [mesures, setMesures] = useState<Mesures | null>(null)

  useEffect(() => {
    void lireProfilLocal().then((profil) => setMesures(profil?.mesures ?? null))
  }, [])

  const terminer = () => {
    marquerAccueilTermine()
    router.replace('/(onglets)/aujourdhui')
  }

  const envoyerCode = async () => {
    const adresse = email.trim().toLowerCase()
    if (!EMAIL.test(adresse)) {
      setErreur(t('compte.erreurEmail'))
      return
    }
    setErreur(null)
    setEnCours(true)
    // An anonymous user becomes permanent by attaching an e-mail (ADR-004); Supabase
    // sends a code to confirm it.
    const { error } = await supabase.auth.updateUser({ email: adresse })
    setEnCours(false)
    if (error) {
      setErreur(t('compte.erreurReseau'))
      return
    }
    setEtape('code')
  }

  const validerCode = async () => {
    setErreur(null)
    setEnCours(true)
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: 'email_change',
    })
    setEnCours(false)
    if (error) {
      setErreur(t('compte.erreurCode'))
      return
    }
    compter('compte_connexion', { methode: 'email' })
    setEtape('prenom')
  }

  // Apple and Google: the system sheet, a token, a session. The first name comes with it when
  // the provider gives one, and the screen only asks for it when it did not.
  const continuerAvec = async (fournisseur: Fournisseur) => {
    setErreur(null)
    setFournisseurEnCours(fournisseur)
    try {
      const identite = await seConnecterAvec(fournisseur)
      compter('compte_connexion', { methode: fournisseur })
      const { data } = await supabase.auth.getSession()
      const id = data.session?.user.id
      if (id) {
        const { data: profil } = await supabase
          .from('profils')
          .select('prenom')
          .eq('id', id)
          .maybeSingle()
        const dejaLa = (profil as { prenom?: string | null } | null)?.prenom?.trim()
        if (dejaLa) {
          terminer()
          return
        }
        if (identite.prenom) {
          await supabase.from('profils').update({ prenom: identite.prenom }).eq('id', id)
          terminer()
          return
        }
      }
      setEtape('prenom')
    } catch (erreur) {
      if (erreur instanceof ErreurIdentite && erreur.raison === 'annule') return
      setErreur(
        erreur instanceof ErreurIdentite && erreur.raison === 'indisponible'
          ? t('compte.fournisseurIndisponible')
          : t('compte.fournisseurEchec', { fournisseur: NOMS[fournisseur] }),
      )
    } finally {
      setFournisseurEnCours(null)
    }
  }

  const enregistrerPrenom = async () => {
    const valide = PrenomSchema.safeParse(prenom)
    if (!valide.success) {
      setErreur(t('compte.prenomAide'))
      return
    }
    setEnCours(true)
    const { data } = await supabase.auth.getSession()
    const id = data.session?.user.id
    if (id) await supabase.from('profils').update({ prenom: valide.data }).eq('id', id)
    setEnCours(false)
    terminer()
  }

  const champ = [
    styles.champ,
    { borderColor: theme.bordure, color: theme.texte, backgroundColor: theme.carte },
  ]
  const debit = mesures?.debit.mots_par_minute ?? null

  const portes = (
    <View style={styles.portes}>
      {fournisseurDisponible('apple') ? (
        <Bouton
          libelle={t('compte.apple')}
          variante="nuit"
          icone={<LogoApple couleur={couleurs.blanc} />}
          chargement={fournisseurEnCours === 'apple'}
          desactive={fournisseurEnCours !== null}
          onPress={() => void continuerAvec('apple')}
        />
      ) : null}
      {fournisseurDisponible('google') ? (
        <Bouton
          libelle={t('compte.google')}
          variante="blanc"
          icone={<LogoGoogle />}
          chargement={fournisseurEnCours === 'google'}
          desactive={fournisseurEnCours !== null}
          onPress={() => void continuerAvec('google')}
        />
      ) : null}
      <Bouton
        libelle={t('compte.email')}
        variante="texte"
        desactive={fournisseurEnCours !== null}
        onPress={() => setEtape('email')}
      />
    </View>
  )

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.fond }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.contenu,
          { paddingTop: insets.top + espaces.xxl, paddingBottom: insets.bottom + espaces.l },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.centre}>
          {etape === 'choix' ? (
            <>
              {mesures ? (
                <CarteProfil
                  etiquette={t('compte.surtitre')}
                  valeur={
                    debit === null
                      ? t('compte.badgeSansMesure')
                      : t('compte.badgeDebit', { n: Math.round(debit) })
                  }
                />
              ) : (
                <Bulle taille="moyenne" style={styles.bulle} />
              )}
              <View style={styles.titres}>
                <Text style={[styles.titre, { color: theme.texte }]}>
                  {connexion ? t('compte.titreConnexion') : t('compte.titre')}
                </Text>
                <Text style={[styles.sousTitre, { color: theme.texteSecondaire }]}>
                  {connexion ? t('compte.introConnexion') : t('compte.intro')}
                </Text>
              </View>
              {portes}
            </>
          ) : null}

          {etape === 'email' ? (
            <>
              <Bulle taille="petite" style={styles.bulle} />
              <View style={styles.titres}>
                <Text style={[styles.titre, { color: theme.texte }]}>{t('compte.emailTitre')}</Text>
                <Text style={[styles.sousTitre, { color: theme.texteSecondaire }]}>
                  {t('compte.emailIntro')}
                </Text>
              </View>
              <View style={styles.formulaire}>
                <Text style={[typographie.etiquette, { color: theme.texteSecondaire }]}>
                  {t('compte.emailChamp')}
                </Text>
                <TextInput
                  style={champ}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  autoFocus
                />
                <Bouton
                  libelle={t('compte.emailEnvoyer')}
                  onPress={() => void envoyerCode()}
                  chargement={enCours}
                />
                <Bouton
                  libelle={t('commun.retour')}
                  variante="texte"
                  onPress={() => {
                    setErreur(null)
                    setEtape('choix')
                  }}
                />
              </View>
            </>
          ) : null}

          {etape === 'code' ? (
            <>
              <Bulle taille="petite" style={styles.bulle} />
              <View style={styles.titres}>
                <Text style={[styles.titre, { color: theme.texte }]}>{t('compte.codeTitre')}</Text>
                <Text style={[styles.sousTitre, { color: theme.texteSecondaire }]}>
                  {t('compte.codeEnvoye', { email: email.trim() })}
                </Text>
              </View>
              <View style={styles.formulaire}>
                <Text style={[typographie.etiquette, { color: theme.texteSecondaire }]}>
                  {t('compte.codeChamp')}
                </Text>
                <TextInput
                  style={[champ, styles.champCode]}
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  maxLength={8}
                  autoFocus
                />
                <Bouton
                  libelle={t('compte.codeValider')}
                  onPress={() => void validerCode()}
                  chargement={enCours}
                  desactive={code.trim().length < 6}
                />
                <Bouton
                  libelle={t('compte.autreAdresse')}
                  variante="texte"
                  onPress={() => {
                    setErreur(null)
                    setCode('')
                    setEtape('email')
                  }}
                />
              </View>
            </>
          ) : null}

          {etape === 'prenom' ? (
            <>
              <Bulle taille="petite" style={styles.bulle} />
              <View style={styles.titres}>
                <Text style={[styles.titre, { color: theme.texte }]}>
                  {t('compte.prenomTitre')}
                </Text>
                <Text style={[styles.sousTitre, { color: theme.texteSecondaire }]}>
                  {t('compte.prenomAide')}
                </Text>
              </View>
              <View style={styles.formulaire}>
                <TextInput
                  style={champ}
                  value={prenom}
                  onChangeText={setPrenom}
                  autoComplete="given-name"
                  textContentType="givenName"
                  placeholder={t('compte.prenomChamp')}
                  placeholderTextColor={theme.texteTertiaire}
                  autoFocus
                />
                <Bouton
                  libelle={t('commun.continuer')}
                  onPress={() => void enregistrerPrenom()}
                  chargement={enCours}
                />
              </View>
            </>
          ) : null}

          {erreur ? (
            <Text style={[typographie.petit, styles.erreur, { color: theme.erreur }]}>
              {erreur}
            </Text>
          ) : null}
        </View>

        {etape === 'choix' ? (
          <View style={styles.pied}>
            <Pressable accessibilityRole="button" onPress={terminer} hitSlop={8}>
              <Text style={[styles.plusTard, { color: theme.lien }]}>{t('compte.plusTard')}</Text>
            </Pressable>
            <Text style={[styles.note, { color: theme.texteTertiaire }]}>
              {t('compte.resteIci')}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

/** The bleu nuit card of the mockup: Bulle, a label in gold, and what the person earned. */
function CarteProfil({ etiquette, valeur }: { etiquette: string; valeur: string }) {
  return (
    <View style={styles.carteProfil}>
      <Degrade de={couleurs.bleu} a={couleurs.bleuNuit} rayon={rayons.xxl} id="nuit" />
      <Bulle taille="petite" calme visage="sourit" />
      <View>
        <Text style={styles.carteEtiquette}>{etiquette}</Text>
        <Text style={styles.carteValeur}>{valeur}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  contenu: { flexGrow: 1, paddingHorizontal: espaces.xl },
  centre: { flex: 1, justifyContent: 'center', alignItems: 'stretch', gap: 22 },
  bulle: { alignSelf: 'center' },
  titres: { alignItems: 'center', gap: espaces.xs },
  titre: {
    fontFamily: polices.extraBold,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.9,
    textAlign: 'center',
  },
  sousTitre: {
    fontFamily: polices.medium,
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 300,
    alignSelf: 'center',
  },
  portes: { gap: 10 },
  formulaire: { gap: espaces.s },
  champ: {
    borderWidth: 1.5,
    borderRadius: rayons.xl,
    paddingHorizontal: espaces.m,
    paddingVertical: espaces.m,
    fontSize: 17,
    fontFamily: polices.semiBold,
  },
  champCode: { textAlign: 'center', letterSpacing: 6, fontSize: 22 },
  erreur: { textAlign: 'center', fontFamily: polices.semiBold },
  pied: { alignItems: 'center', gap: 10, paddingTop: espaces.l },
  plusTard: { fontFamily: polices.bold, fontSize: 15, lineHeight: 20 },
  note: { fontFamily: polices.semiBold, fontSize: 12, lineHeight: 16, textAlign: 'center' },
  carteProfil: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: espaces.m,
    paddingHorizontal: 22,
    borderRadius: rayons.xxl,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: couleurs.bleu,
        shadowOpacity: 0.28,
        shadowRadius: 15,
        shadowOffset: { width: 0, height: 14 },
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  carteEtiquette: {
    textTransform: 'uppercase',
    fontFamily: polices.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.1,
    color: couleurs.or,
  },
  carteValeur: {
    fontFamily: polices.extraBold,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.55,
    color: couleurs.blanc,
  },
})
