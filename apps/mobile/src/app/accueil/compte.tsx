import { PrenomSchema } from '@leq/domaine'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Bulle } from '@/components/Bulle'
import { Bouton } from '@/components/ui/Bouton'
import { Titre } from '@/components/ui/Titre'
import { t } from '@/i18n/fr'
import { useDemarrage } from '@/services/configuration'
import {
  ErreurIdentite,
  fournisseurDisponible,
  seConnecterAvec,
  type Fournisseur,
} from '@/services/identite'
import { supabase } from '@/services/supabase'
import { compter } from '@/services/usage'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, rayons, typographie } from '@/theme/tokens'

// A7 · Garder son profil. The account comes after the gift, never before. Refusing keeps
// everything on the phone. Three doors: Apple and Google through the system sheet, e-mail
// through a six-digit code.

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

  return (
    <ScrollView
      style={{ backgroundColor: theme.fond }}
      contentContainerStyle={[
        styles.contenu,
        { paddingTop: insets.top + espaces.xl, paddingBottom: insets.bottom + espaces.xl },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[typographie.etiquette, { color: theme.texteTertiaire }]}>
        {t('compte.surtitre')}
      </Text>
      <View style={styles.entete}>
        <Bulle taille="petite" />
        <Titre niveau="ecran">{connexion ? t('compte.titreConnexion') : t('compte.titre')}</Titre>
      </View>
      <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
        {connexion ? t('compte.introConnexion') : t('compte.intro')}
      </Text>

      {etape === 'choix' ? (
        <View style={styles.bloc}>
          {fournisseurDisponible('apple') ? (
            <Bouton
              libelle={t('compte.apple')}
              variante="secondaire"
              chargement={fournisseurEnCours === 'apple'}
              desactive={fournisseurEnCours !== null}
              onPress={() => void continuerAvec('apple')}
            />
          ) : null}
          {fournisseurDisponible('google') ? (
            <Bouton
              libelle={t('compte.google')}
              variante="secondaire"
              chargement={fournisseurEnCours === 'google'}
              desactive={fournisseurEnCours !== null}
              onPress={() => void continuerAvec('google')}
            />
          ) : null}
          <Bouton
            libelle={t('compte.email')}
            desactive={fournisseurEnCours !== null}
            onPress={() => setEtape('email')}
          />
        </View>
      ) : null}

      {etape === 'email' ? (
        <View style={styles.bloc}>
          <Text style={[typographie.etiquette, { color: theme.texte }]}>
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
          />
          <Bouton
            libelle={t('compte.emailEnvoyer')}
            onPress={() => void envoyerCode()}
            chargement={enCours}
          />
        </View>
      ) : null}

      {etape === 'code' ? (
        <View style={styles.bloc}>
          <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
            {t('compte.codeEnvoye', { email: email.trim() })}
          </Text>
          <Text style={[typographie.etiquette, { color: theme.texte }]}>
            {t('compte.codeChamp')}
          </Text>
          <TextInput
            style={champ}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            maxLength={8}
          />
          <Bouton
            libelle={t('compte.codeValider')}
            onPress={() => void validerCode()}
            chargement={enCours}
            desactive={code.trim().length < 6}
          />
        </View>
      ) : null}

      {etape === 'prenom' ? (
        <View style={styles.bloc}>
          <Text style={[typographie.etiquette, { color: theme.texte }]}>
            {t('compte.prenomChamp')}
          </Text>
          <TextInput
            style={champ}
            value={prenom}
            onChangeText={setPrenom}
            autoComplete="given-name"
            textContentType="givenName"
          />
          <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>
            {t('compte.prenomAide')}
          </Text>
          <Bouton
            libelle={t('commun.continuer')}
            onPress={() => void enregistrerPrenom()}
            chargement={enCours}
          />
        </View>
      ) : null}

      {erreur ? (
        <Text style={[typographie.corps, styles.note, { color: theme.erreur }]}>{erreur}</Text>
      ) : null}

      {etape !== 'prenom' ? (
        <View style={styles.actions}>
          <Bouton libelle={t('compte.plusTard')} variante="texte" onPress={terminer} />
          <Text style={[typographie.petit, styles.note, { color: theme.texteTertiaire }]}>
            {t('compte.resteIci')}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  contenu: { flexGrow: 1, paddingHorizontal: espaces.xl, gap: espaces.m },
  entete: { flexDirection: 'row', alignItems: 'center', gap: espaces.s },
  bloc: { gap: espaces.s, marginTop: espaces.s },
  champ: {
    borderWidth: 1.5,
    borderRadius: rayons.m,
    paddingHorizontal: espaces.m,
    paddingVertical: espaces.s,
    fontSize: 16,
  },
  note: { textAlign: 'center' },
  actions: { marginTop: 'auto', gap: espaces.xs, paddingTop: espaces.l },
})
