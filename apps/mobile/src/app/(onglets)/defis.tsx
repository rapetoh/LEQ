import { useRouter } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { CartePlaceholder } from '@/components/CartePlaceholder'
import { EnteteEcran } from '@/components/EnteteEcran'
import { Bouton } from '@/components/ui/Bouton'
import { Carte } from '@/components/ui/Carte'
import { Icone } from '@/components/ui/Icone'
import { t } from '@/i18n/fr'
import { useCarte, type ActeCarte, type EtapeCarte } from '@/services/parcours'
import { chiffreRomain, compterReleves, destinationNoeud } from '@/services/rythme'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, typographie } from '@/theme/tokens'

// H1 · Défis, the map of acts. Three lands stacked like a map: the mist on top (acts to
// come), the current act wide open in the middle, the acts won folded at the bottom.
// The orange node opens the brief (B3); a folded act opens its results (H4).

export default function Defis() {
  const theme = useTheme()
  const carte = useCarte()

  const releves = carte.data ? compterReleves(carte.data) : null
  const actes = carte.data ? [...carte.data].sort((a, b) => b.ordre - a.ordre) : []

  return (
    <ScrollView style={{ backgroundColor: theme.fond }} contentContainerStyle={styles.contenu}>
      <EnteteEcran
        titre={t('carte.titre')}
        droite={
          releves ? (
            <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>
              {t('carte.releves', releves)}
            </Text>
          ) : undefined
        }
      />
      <View style={styles.sections}>
        {carte.isPending ? (
          <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
            {t('commun.chargement')}
          </Text>
        ) : carte.isError ? (
          <Carte style={styles.bloc}>
            <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
              {t('erreurs.generique')}
            </Text>
            <Bouton
              libelle={t('commun.reessayer')}
              variante="secondaire"
              onPress={() => void carte.refetch()}
            />
          </Carte>
        ) : actes.length === 0 ? (
          <CartePlaceholder phrase={t('carte.vide')} />
        ) : (
          actes.map((acte) => <Acte key={acte.id} acte={acte} />)
        )}
      </View>
    </ScrollView>
  )
}

function Acte({ acte }: { acte: ActeCarte }) {
  const theme = useTheme()
  const router = useRouter()
  const numero = chiffreRomain(acte.ordre)
  const faits = acte.etapes.filter((e) => e.statut === 'validee').length

  if (acte.statut === 'a_venir') {
    return (
      <Carte teinte="douce" style={styles.bloc}>
        <Text style={[typographie.titreCarte, { color: theme.texte }]}>
          {t('carte.acte', { acte: numero, titre: acte.titre })}
        </Text>
        <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>
          {t('carte.sousLaBrume')}
        </Text>
      </Carte>
    )
  }

  if (acte.statut === 'traverse') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('carte.acte', { acte: numero, titre: acte.titre })}
        onPress={() => router.push(`/acte/${acte.id}`)}
      >
        <Carte teinte="voix" style={[styles.bloc, styles.ligne]}>
          <View style={{ flex: 1, gap: espaces.xxs }}>
            <Text style={[typographie.titreCarte, { color: theme.texte }]}>
              {t('carte.acte', { acte: numero, titre: acte.titre })}
            </Text>
            <Text style={[typographie.petit, { color: theme.texteSecondaire }]}>
              {t('carte.traverse', { faits, total: acte.etapes.length })}
            </Text>
          </View>
          <Icone sf="chevron.right" material="chevron-right" taille={20} couleur={theme.texte} />
        </Carte>
      </Pressable>
    )
  }

  return (
    <Carte style={styles.bloc}>
      <View style={{ gap: espaces.xxs }}>
        <Text style={[typographie.etiquette, { color: theme.accent }]}>
          {t('carte.enCours', { acte: numero })}
        </Text>
        <Text style={[typographie.titreSection, { color: theme.texte }]}>
          {acte.sous_titre ?? acte.titre}
        </Text>
      </View>
      {acte.etapes.length === 0 ? (
        <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>{t('carte.vide')}</Text>
      ) : (
        <View style={styles.noeuds}>
          {acte.etapes.map((etape) => (
            <Noeud key={etape.id} etape={etape} />
          ))}
        </View>
      )}
    </Carte>
  )
}

function Noeud({ etape }: { etape: EtapeCarte }) {
  const theme = useTheme()
  const router = useRouter()
  const destination = destinationNoeud(etape)
  const ouvert = destination !== 'aucune'
  const fond =
    etape.statut === 'validee'
      ? theme.voix
      : etape.statut === 'disponible'
        ? theme.accent
        : theme.carteDouce
  const format =
    etape.defi.format === 'texte'
      ? t('carte.formatTexte')
      : etape.defi.format === 'long'
        ? t('carte.formatLong')
        : null
  const detail = [format, t('aujourdhui.points', { points: etape.defi.points })]
    .filter(Boolean)
    .join(' · ')

  const contenu = (
    <View style={[styles.ligne, etape.statut === 'verrouillee' && styles.verrouille]}>
      <View style={[styles.pastille, { backgroundColor: fond }]}>
        {etape.statut === 'validee' ? (
          <Icone sf="checkmark" material="check" taille={16} couleur={theme.texte} />
        ) : etape.statut === 'verrouillee' ? (
          <Icone sf="lock.fill" material="lock" taille={14} couleur={theme.texteTertiaire} />
        ) : (
          <Icone sf="play.fill" material="play-arrow" taille={14} couleur={theme.accentTexte} />
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[typographie.corpsFort, { color: theme.texte }]}>{etape.defi.titre}</Text>
        <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>{detail}</Text>
      </View>
      {ouvert ? (
        <Text style={[typographie.etiquette, { color: theme.accent }]}>{t('carte.ouvrir')}</Text>
      ) : null}
    </View>
  )

  if (!ouvert) return contenu
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etape.defi.titre}
      onPress={() =>
        router.push(
          destination === 'rattrapage' ? `/defi/${etape.id}/rattrapage` : `/defi/${etape.id}`,
        )
      }
    >
      {contenu}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  contenu: { paddingBottom: espaces.xxl },
  sections: { paddingHorizontal: espaces.xl, gap: espaces.m },
  bloc: { gap: espaces.m },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espaces.s },
  noeuds: { gap: espaces.m },
  pastille: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verrouille: { opacity: 0.55 },
})
