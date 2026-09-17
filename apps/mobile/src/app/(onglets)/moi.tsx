import { useRouter } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useEspaceBarreOnglets } from '@/components/BarreOnglets'
import { Avatar } from '@/components/Avatar'
import { Bulle } from '@/components/Bulle'
import { Carte } from '@/components/ui/Carte'
import { Icone, type NomMaterial, type NomSF } from '@/components/ui/Icone'
import { t } from '@/i18n/fr'
import { urlAvatar } from '@/services/photo'
import { nomFormule, useFormules } from '@/services/formules'
import { moisEtAnnee, useDerniereMesure, useProfil } from '@/services/profil'
import { usePoints, useSerie } from '@/services/progres'
import { ilYA } from '@/services/rythme'
import { useSession } from '@/services/supabase'
import { useTheme } from '@/theme/ThemeProvider'
import { couleurs, espaces, polices, rayons, typographie } from '@/theme/tokens'

// G1 · Moi, as the mockup lays it out: the person first (who they are, how they speak), the
// three numbers replayed from the ledgers (ADR-009), then the doors. The card at the top opens
// the account; administration lives behind it and in Réglages, never on this screen.

export default function Moi() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const espaceBarre = useEspaceBarreOnglets()
  const formules = useFormules()
  const serie = useSerie()
  const points = usePoints()
  const profil = useProfil()
  const derniere = useDerniereMesure()
  const { session } = useSession()
  const anonyme = session?.user.is_anonymous === true
  const prenom = profil.data?.prenom?.trim() ?? null
  const formule = points.data ? nomFormule(formules.data, points.data.formule) : null

  return (
    <ScrollView
      style={{ backgroundColor: theme.fond }}
      contentContainerStyle={[
        styles.contenu,
        { paddingTop: insets.top + espaces.l, paddingBottom: espaceBarre },
      ]}
    >
      {/* Who: the card is the door to the account. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={anonyme ? t('moi.compte.creer') : t('moi.monCompte.titre')}
        onPress={() => router.push(anonyme ? '/accueil/compte' : '/moi/compte')}
        style={({ pressed }) => [pressed && styles.presse]}
      >
        <Carte style={styles.identite}>
          <Avatar
            prenom={prenom}
            uri={urlAvatar(profil.data?.avatar_chemin)}
            taille={64}
            flamme={(serie.data?.courante ?? 0) > 0}
          />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[styles.nom, { color: theme.texte }]} numberOfLines={1}>
              {prenom ?? t('compte.surtitre')}
            </Text>
            <Text style={[styles.sousNom, { color: theme.lien }]} numberOfLines={1}>
              {anonyme
                ? t('moi.compte.sansCompte')
                : [
                    formule,
                    profil.data
                      ? t('moi.depuis', { mois: moisEtAnnee(profil.data.cree_le) })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
            </Text>
          </View>
          <Chevron />
        </Carte>
      </Pressable>

      {/* How they speak: the last take's measures, or the invitation to make the first one. */}
      {derniere.data ? (
        <Carte style={styles.voix}>
          <View style={styles.voixEntete}>
            <Text style={[styles.etiquette, { color: theme.texteSecondaire }]}>
              {t('moi.identite.titre')}
            </Text>
            <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>
              {t('moi.identite.derniere', { quand: ilYA(derniere.data.enregistre_le) })}
            </Text>
          </View>
          <View style={styles.mesures}>
            <Mesure
              valeur={
                derniere.data.mesures.debit.mots_par_minute === null
                  ? '·'
                  : String(Math.round(derniere.data.mesures.debit.mots_par_minute))
              }
              libelle={t('moi.identite.debit')}
            />
            <Separateur />
            <Mesure
              valeur={String(derniere.data.mesures.mots_bequilles.total)}
              libelle={t('moi.identite.bequilles')}
            />
            <Separateur />
            <Mesure
              valeur={String(derniere.data.mesures.silences.tenus)}
              libelle={t('moi.identite.silences')}
            />
          </View>
        </Carte>
      ) : derniere.isPending ? null : (
        <Carte teinte="douce" style={styles.premiere}>
          <Bulle taille="petite" calme visage="sourit" />
          <View style={{ flex: 1, gap: espaces.xs }}>
            <Text style={[typographie.corps, { color: theme.texte }]}>
              {t('moi.placeholderProfil')}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace('/(onglets)/aujourdhui')}
              hitSlop={8}
            >
              <Text style={[styles.lien, { color: theme.lien }]}>{t('moi.identite.premiere')}</Text>
            </Pressable>
          </View>
        </Carte>
      )}

      {/* The three numbers. */}
      <View style={styles.tuiles}>
        <Tuile
          valeur={serie.data ? String(serie.data.courante) : '·'}
          libelle={serie.data?.courante === 1 ? t('moi.jourDeSuite') : t('moi.joursDeSuite')}
          couleur={couleurs.rouge}
        />
        <Tuile
          valeur={points.data ? formaterEntier(points.data.solde) : '·'}
          libelle={t('moi.points')}
          couleur={theme.lien}
        />
        <Tuile
          valeur={serie.data ? String(serie.data.semaines_gagnees) : '·'}
          libelle={
            serie.data?.semaines_gagnees === 1 ? t('moi.semaineGagnee') : t('moi.semainesGagnees')
          }
          couleur={theme.texte}
        />
      </View>

      {/* The doors. */}
      <Carte style={styles.menu}>
        <LigneMenu
          sf="star.fill"
          material="star"
          teinte={theme.sombre ? theme.carteDouce : couleurs.bleuDoux}
          couleurIcone={couleurs.bleu}
          libelle={t('moi.mesRecompenses')}
          onPress={() => router.push('/recompenses')}
        />
        <LigneMenu
          sf="checkmark.seal.fill"
          material="verified"
          teinte={theme.sombre ? theme.carteDouce : couleurs.vertDoux}
          couleurIcone={couleurs.vert}
          libelle={t('moi.monAbonnement')}
          valeur={formule ?? undefined}
          onPress={() => router.push(anonyme ? '/accueil/compte' : '/moi/compte')}
        />
        <LigneMenu
          sf="gearshape.fill"
          material="settings"
          teinte={theme.sombre ? theme.carteDouce : couleurs.neutreDoux}
          couleurIcone={couleurs.encre}
          libelle={t('moi.reglages')}
          onPress={() => router.push('/reglages')}
          derniere
        />
      </Carte>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/rebecca')}
        style={({ pressed }) => [pressed && styles.presse]}
      >
        <View
          style={[
            styles.rebecca,
            { backgroundColor: theme.sombre ? theme.carteDouce : couleurs.bleuDoux },
          ]}
        >
          <Text style={[styles.rebeccaTexte, { color: theme.lien, flex: 1 }]}>
            {t('moi.ateliers')}
          </Text>
          <Chevron couleur={theme.lien} />
        </View>
      </Pressable>
    </ScrollView>
  )
}

/** "1 240": French thousands separator through Intl. */
export function formaterEntier(valeur: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(valeur)
}

function Chevron({ couleur }: { couleur?: string }) {
  const theme = useTheme()
  return (
    <Icone
      sf="chevron.right"
      material="chevron-right"
      taille={16}
      couleur={couleur ?? theme.texteTertiaire}
    />
  )
}

function Mesure({ valeur, libelle }: { valeur: string; libelle: string }) {
  const theme = useTheme()
  return (
    <View style={styles.mesure}>
      <Text style={[styles.mesureValeur, { color: theme.texte }]}>{valeur}</Text>
      <Text style={[styles.tuileLibelle, { color: theme.texteSecondaire }]}>{libelle}</Text>
    </View>
  )
}

function Separateur() {
  const theme = useTheme()
  return <View style={[styles.separateur, { backgroundColor: theme.bordure }]} />
}

function Tuile({ valeur, libelle, couleur }: { valeur: string; libelle: string; couleur: string }) {
  const theme = useTheme()
  return (
    <Carte style={styles.tuile}>
      <Text style={[styles.tuileValeur, { color: couleur }]}>{valeur}</Text>
      <Text style={[styles.tuileLibelle, { color: theme.texteSecondaire }]}>{libelle}</Text>
    </Carte>
  )
}

function LigneMenu({
  sf,
  material,
  teinte,
  couleurIcone,
  libelle,
  valeur,
  onPress,
  derniere = false,
}: {
  sf: NomSF
  material: NomMaterial
  teinte: string
  couleurIcone: string
  libelle: string
  valeur?: string | undefined
  onPress: () => void
  derniere?: boolean
}) {
  const theme = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.ligne,
        !derniere && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.bordure,
        },
        pressed && styles.presse,
      ]}
    >
      <View style={[styles.pastille, { backgroundColor: teinte }]}>
        <Icone sf={sf} material={material} taille={16} couleur={couleurIcone} />
      </View>
      <Text style={[styles.ligneLibelle, { color: theme.texte, flex: 1 }]}>{libelle}</Text>
      {valeur ? <Text style={[styles.ligneValeur, { color: theme.lien }]}>{valeur}</Text> : null}
      <Chevron />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  contenu: { paddingHorizontal: espaces.xl, gap: 14 },
  presse: { opacity: 0.8 },
  identite: { flexDirection: 'row', alignItems: 'center', gap: espaces.m, padding: espaces.m },
  nom: { fontFamily: polices.extraBold, fontSize: 24, lineHeight: 28, letterSpacing: -0.6 },
  sousNom: { fontFamily: polices.bold, fontSize: 13, lineHeight: 18 },
  voix: { gap: espaces.m, padding: espaces.l },
  voixEntete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  etiquette: {
    textTransform: 'uppercase',
    fontFamily: polices.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.1,
  },
  mesures: { flexDirection: 'row', alignItems: 'center' },
  mesure: { flex: 1, alignItems: 'center', gap: 4 },
  mesureValeur: {
    fontFamily: polices.extraBold,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.5,
  },
  separateur: { width: StyleSheet.hairlineWidth, height: 36 },
  premiere: { flexDirection: 'row', alignItems: 'center', gap: espaces.m, padding: espaces.l },
  lien: { fontFamily: polices.bold, fontSize: 14, lineHeight: 18 },
  tuiles: { flexDirection: 'row', gap: 10 },
  tuile: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: espaces.m,
    paddingHorizontal: espaces.xs,
    borderRadius: rayons.xxl,
  },
  tuileValeur: { fontFamily: polices.extraBold, fontSize: 22, lineHeight: 26, letterSpacing: -0.4 },
  tuileLibelle: {
    textTransform: 'uppercase',
    fontFamily: polices.bold,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  menu: { paddingVertical: 6, paddingHorizontal: espaces.l, gap: 0 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15 },
  pastille: {
    width: 34,
    height: 34,
    borderRadius: rayons.s,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ligneLibelle: { fontFamily: polices.bold, fontSize: 15, lineHeight: 20 },
  ligneValeur: { fontFamily: polices.bold, fontSize: 12.5, lineHeight: 16 },
  rebecca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaces.s,
    paddingVertical: espaces.m,
    paddingHorizontal: 18,
    borderRadius: rayons.xl,
  },
  rebeccaTexte: { fontFamily: polices.semiBold, fontSize: 13, lineHeight: 19.5 },
})
