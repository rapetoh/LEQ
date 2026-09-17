import { useLocalSearchParams, useRouter } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Bulle } from '@/components/Bulle'
import { EcranChargement, EcranErreur } from '@/components/EcransEtat'
import { Bouton } from '@/components/ui/Bouton'
import { Titre } from '@/components/ui/Titre'
import { t } from '@/i18n/fr'
import { useCarte, useObjectifsActes, type EtapeCarte } from '@/services/parcours'
import { chiffreRomain } from '@/services/rythme'
import { useBarreEtatClaire } from '@/components/BarreEtat'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, typographie } from '@/theme/tokens'

// H3 · L'acte traversé. Replaces H2 when the last défi of an act is validated: the act
// turns gold, Bulle celebrates, the next land shows itself. Sober, adult. The act's own
// closing line is content (Rebecca); until then the screen counts what was done.

export default function ActeTraverse() {
  const params = useLocalSearchParams<{ acteId?: string }>()
  const acteId = typeof params.acteId === 'string' ? params.acteId : null
  const theme = useTheme()
  useBarreEtatClaire()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const carte = useCarte()
  const objectifs = useObjectifsActes()

  if (carte.isPending) return <EcranChargement />
  if (carte.isError) {
    return <EcranErreur message={carte.error.message} reessayer={() => void carte.refetch()} />
  }
  const acte = carte.data.find((a) => a.id === acteId)
  if (!acte) {
    return <EcranErreur message={t('carte.introuvable')} reessayer={() => router.back()} />
  }
  const suivant = carte.data.find((a) => a.ordre === acte.ordre + 1) ?? null
  const nb = acte.etapes.length
  const objectif = objectifs.data?.get(acte.ordre) ?? null
  const chemin = objectif ? cheminDeLArc(acte.etapes) : null

  return (
    <View
      style={[
        styles.ecran,
        {
          backgroundColor: theme.hero,
          paddingTop: insets.top + espaces.xxl,
          paddingBottom: insets.bottom + espaces.xl,
        },
      ]}
    >
      <View style={styles.centre}>
        <Bulle taille="grande" />
        <Text style={[typographie.etiquette, { color: theme.voix }]}>
          {t('defi.acteTraverse.surtitre', { acte: chiffreRomain(acte.ordre) })}
        </Text>
        <Titre niveau="hero" surFondSombre centre>
          {acte.titre}
        </Titre>
        <Text style={[typographie.corps, styles.texteCentre, { color: theme.heroTexteSecondaire }]}>
          {nb === 1 ? t('defi.acteTraverse.corpsUn') : t('defi.acteTraverse.corps', { nb })}
        </Text>
        {objectif ? (
          <Text style={[typographie.corpsFort, styles.texteCentre, { color: theme.voix }]}>
            {t('defi.acteTraverse.objectif', { objectif })}
          </Text>
        ) : null}
        {chemin ? (
          <View style={styles.chemin}>
            <Text style={[typographie.etiquette, { color: theme.heroTexteSecondaire }]}>
              {t('defi.acteTraverse.depuisLeDepart')}
            </Text>
            {chemin.map((ligne) => (
              <View key={ligne.libelle} style={styles.ligneChemin}>
                <Text style={[typographie.petit, { color: theme.heroTexteSecondaire }]}>
                  {ligne.libelle}
                </Text>
                <Text style={[typographie.corpsFort, { color: theme.heroTexte }]}>
                  {t('defi.acteTraverse.avantApres', { avant: ligne.avant, apres: ligne.apres })}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        {!suivant ? (
          <Text
            style={[typographie.corps, styles.texteCentre, { color: theme.heroTexteSecondaire }]}
          >
            {t('defi.acteTraverse.fin')}
          </Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        {suivant ? (
          <Bouton
            variante="or"
            libelle={t('defi.acteTraverse.decouvrir', {
              acte: chiffreRomain(suivant.ordre),
              titre: suivant.titre,
            })}
            onPress={() => router.replace('/(onglets)/defis')}
          />
        ) : (
          <Bouton
            variante="or"
            libelle={t('defi.resultat.carte')}
            onPress={() => router.replace('/(onglets)/defis')}
          />
        )}
        <Bouton
          libelle={t('defi.acteTraverse.plusTard')}
          variante="texte"
          surFondSombre
          onPress={() => router.replace('/(onglets)/aujourdhui')}
        />
      </View>
    </View>
  )
}

/**
 * The arc read from its first validated take to its last: rate, fillers, the grid score. Only
 * what both takes have; an arc of one take, or one without measures, shows nothing.
 */
function cheminDeLArc(
  etapes: readonly EtapeCarte[],
): { libelle: string; avant: string; apres: string }[] | null {
  const faites = etapes.filter((e) => e.statut === 'validee' && e.resultat !== null)
  if (faites.length < 2) return null
  const premiere = faites[0]!.resultat!
  const derniere = faites[faites.length - 1]!.resultat!
  const lignes: { libelle: string; avant: string; apres: string }[] = []
  if (premiere.mots_par_minute !== null && derniere.mots_par_minute !== null) {
    lignes.push({
      libelle: t('defi.acteTraverse.debit'),
      avant: t('defi.acteTraverse.motsParMin', { n: Math.round(premiere.mots_par_minute) }),
      apres: t('defi.acteTraverse.motsParMin', { n: Math.round(derniere.mots_par_minute) }),
    })
  }
  if (premiere.bequilles !== null && derniere.bequilles !== null) {
    lignes.push({
      libelle: t('defi.acteTraverse.bequilles'),
      avant: String(premiere.bequilles),
      apres: String(derniere.bequilles),
    })
  }
  if (
    premiere.note_totale !== null &&
    premiere.note_max !== null &&
    derniere.note_totale !== null &&
    derniere.note_max !== null
  ) {
    const f = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(n)
    lignes.push({
      libelle: t('defi.acteTraverse.note'),
      avant: t('carte.note', { note: f(premiere.note_totale), max: f(premiere.note_max) }),
      apres: t('carte.note', { note: f(derniere.note_totale), max: f(derniere.note_max) }),
    })
  }
  return lignes.length > 0 ? lignes : null
}

const styles = StyleSheet.create({
  ecran: { flex: 1, paddingHorizontal: espaces.xl, justifyContent: 'space-between' },
  chemin: { alignSelf: 'stretch', gap: espaces.xs, marginTop: espaces.s },
  ligneChemin: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  centre: { alignItems: 'center', gap: espaces.m, flex: 1, justifyContent: 'center' },
  texteCentre: { textAlign: 'center' },
  actions: { gap: espaces.s },
})
