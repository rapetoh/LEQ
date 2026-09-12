import { useRouter } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { useEspaceBarreOnglets } from '@/components/BarreOnglets'
import { CartePlaceholder } from '@/components/CartePlaceholder'
import { EnteteEcran } from '@/components/EnteteEcran'
import { Bouton } from '@/components/ui/Bouton'
import { Carte } from '@/components/ui/Carte'
import { Icone } from '@/components/ui/Icone'
import { t } from '@/i18n/fr'
import { useDrapeaux } from '@/services/configuration'
import { moisEtAnnee, useProfil } from '@/services/profil'
import { supabase, useSession } from '@/services/supabase'
import { usePoints, useSerie } from '@/services/progres'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, rayons, typographie } from '@/theme/tokens'

// G1 · Moi. The speaker identity first, administration after. Settings live in G3 (/reglages).
// The three numbers are replayed from the ledgers (ADR-009), never counted here.

export default function Moi() {
  const theme = useTheme()
  const router = useRouter()
  const drapeaux = useDrapeaux()
  const serie = useSerie()
  const points = usePoints()
  const espaceBarre = useEspaceBarreOnglets()
  const profil = useProfil()
  const { session, reessayer } = useSession()
  const anonyme = session?.user.is_anonymous === true
  const email = session?.user.email ?? null
  const prenom = profil.data?.prenom?.trim() ?? null

  const lignes: { libelle: string; detail?: string; action?: () => void }[] = [
    // E0 · The door of the face-à-face. It only exists when the flag is on: no ghost row.
    ...(drapeaux.data?.face_a_face === true
      ? [{ libelle: t('moi.faceAFace'), action: () => router.push('/face-a-face') }]
      : []),
    { libelle: t('moi.mesRecompenses'), action: () => router.push('/recompenses') },
    {
      libelle: t('moi.monAbonnement'),
      ...(points.data ? { detail: t(`formules.${points.data.formule}`) } : {}),
    },
    { libelle: t('moi.reglages'), action: () => router.push('/reglages') },
  ]

  return (
    <ScrollView style={{ backgroundColor: theme.fond }} contentContainerStyle={[styles.contenu, { paddingBottom: espaceBarre }]}>
      <EnteteEcran titre={t('moi.titre')} />

      <View style={styles.sections}>
        <View style={styles.identite}>
          <View>
            <View style={[styles.avatar, { backgroundColor: theme.voixDoux }]}>
              <Text style={[typographie.titreSection, { color: theme.texte }]}>
                {prenom ? prenom.charAt(0).toUpperCase() : '·'}
              </Text>
            </View>
            {serie.data && serie.data.courante > 0 ? (
              <View style={[styles.flamme, { backgroundColor: theme.carte }]}>
                <Icone
                  sf="flame.fill"
                  material="local-fire-department"
                  taille={14}
                  couleur={theme.accent}
                />
              </View>
            ) : null}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[typographie.titreSection, { color: theme.texte }]}>
              {prenom ?? t('profil.titre')}
            </Text>
            {profil.data ? (
              <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>
                {t('moi.depuis', { mois: moisEtAnnee(profil.data.cree_le) })}
              </Text>
            ) : null}
          </View>
        </View>
        {anonyme ? (
          <Carte teinte="voix" style={styles.compte}>
            <Text style={[typographie.corpsFort, { color: theme.texte }]}>
              {t('moi.compte.sansCompte')}
            </Text>
            <Text style={[typographie.petit, { color: theme.texteSecondaire }]}>
              {t('moi.compte.sansCompteDetail')}
            </Text>
            <Bouton
              libelle={t('moi.compte.creer')}
              onPress={() => router.push('/accueil/compte')}
            />
          </Carte>
        ) : email ? (
          <View style={styles.ligne}>
            <Text style={[typographie.petit, { color: theme.texteTertiaire, flex: 1 }]}>
              {t('moi.compte.connecte', { email })}
            </Text>
            <Bouton
              libelle={t('moi.compte.deconnexion')}
              variante="texte"
              onPress={() => {
                void supabase.auth.signOut().then(() => reessayer())
              }}
            />
          </View>
        ) : null}
        <CartePlaceholder phrase={t('moi.placeholderProfil')} />

        <View style={styles.chiffres}>
          <Chiffre
            valeur={serie.data ? String(serie.data.courante) : '·'}
            libelle={serie.data?.courante === 1 ? t('moi.jourDeSuite') : t('moi.joursDeSuite')}
            teinte="voix"
          />
          <Chiffre
            valeur={points.data ? formaterEntier(points.data.solde) : '·'}
            libelle={t('moi.points')}
            teinte="orange"
          />
          <Chiffre
            valeur={serie.data ? String(serie.data.semaines_gagnees) : '·'}
            libelle={
              serie.data?.semaines_gagnees === 1 ? t('moi.semaineGagnee') : t('moi.semainesGagnees')
            }
            teinte="douce"
          />
        </View>

        <Carte style={styles.liste}>
          {lignes.map((ligne, index) => (
            <Pressable
              key={ligne.libelle}
              accessibilityRole={ligne.action ? 'button' : undefined}
              onPress={ligne.action}
              disabled={!ligne.action}
              style={[
                styles.ligne,
                index > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: theme.bordure,
                },
              ]}
            >
              <Text style={[typographie.corpsFort, { color: theme.texte, flex: 1 }]}>
                {ligne.libelle}
              </Text>
              {ligne.detail ? (
                <Text style={[typographie.petit, { color: theme.texteSecondaire }]}>
                  {ligne.detail}
                </Text>
              ) : null}
              {ligne.action ? (
                <Text style={[typographie.corpsFort, { color: theme.texteTertiaire }]}>›</Text>
              ) : ligne.detail ? null : (
                <View style={[styles.puce, { backgroundColor: theme.carteDouce }]}>
                  <Text style={[typographie.etiquette, { color: theme.texteSecondaire }]}>
                    {t('commun.bientot')}
                  </Text>
                </View>
              )}
            </Pressable>
          ))}
        </Carte>

        <Pressable accessibilityRole="button" onPress={() => router.push('/rebecca')}>
          <Carte teinte="voix" style={styles.ligne}>
            <Text style={[typographie.corpsFort, { color: theme.texte, flex: 1 }]}>
              {t('moi.ateliers')}
            </Text>
            <Text style={[typographie.corpsFort, { color: theme.texteTertiaire }]}>›</Text>
          </Carte>
        </Pressable>
      </View>
    </ScrollView>
  )
}

/** "1 240": French thousands separator through Intl. */
export function formaterEntier(valeur: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(valeur)
}

function Chiffre({
  valeur,
  libelle,
  teinte,
}: {
  valeur: string
  libelle: string
  teinte: 'voix' | 'orange' | 'douce'
}) {
  const theme = useTheme()
  return (
    <Carte teinte={teinte} style={styles.chiffre}>
      <Text style={[typographie.chiffre, { color: theme.texte }]}>{valeur}</Text>
      <Text style={[typographie.petit, { color: theme.texteSecondaire }]}>{libelle}</Text>
    </Carte>
  )
}

const styles = StyleSheet.create({
  contenu: {},
  sections: { paddingHorizontal: espaces.xl, gap: espaces.l },
  compte: { gap: espaces.xs },
  identite: { flexDirection: 'row', alignItems: 'center', gap: espaces.m },
  flamme: {
    position: 'absolute',
    right: -4,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chiffres: { flexDirection: 'row', gap: espaces.xs },
  chiffre: { flex: 1, alignItems: 'center', gap: espaces.xxs, paddingHorizontal: espaces.xs },
  liste: { paddingVertical: 0 },
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaces.s,
    paddingVertical: espaces.m,
  },
  puce: {
    paddingHorizontal: espaces.xs,
    paddingVertical: espaces.xxs,
    borderRadius: rayons.pilule,
  },
})
