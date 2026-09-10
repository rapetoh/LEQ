import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'

import { Bulle } from '@/components/Bulle'
import { CartePlaceholder } from '@/components/CartePlaceholder'
import { EnteteEcran } from '@/components/EnteteEcran'
import { Bouton } from '@/components/ui/Bouton'
import { Carte } from '@/components/ui/Carte'
import { Icone } from '@/components/ui/Icone'
import { t } from '@/i18n/fr'
import {
  RAYON_COURANT,
  RAYON_NOEUD,
  disposerNoeuds,
  gaucheEtiquette,
  hauteurCarte,
  tracer,
} from '@/services/carteVue'
import { useCarte, type ActeCarte, type EtapeCarte } from '@/services/parcours'
import { chiffreRomain, compterReleves, destinationNoeud } from '@/services/rythme'
import { useTheme } from '@/theme/ThemeProvider'
import { couleurs, espaces, rayons, typographie } from '@/theme/tokens'

// H1 · Défis, the map of acts, as the mockup draws it: the mist on top (a bleu nuit banner
// with a lock), the current act as a land with a winding path and its nodes, the acts won
// folded at the bottom in "or". The orange node opens the brief; a folded act opens H4.

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
            <Text style={[typographie.etiquette, { color: theme.texteSecondaire }]}>
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
          actes.map((acte) =>
            acte.statut === 'a_venir' ? (
              <Brume key={acte.id} acte={acte} />
            ) : acte.statut === 'traverse' ? (
              <ActeTraverse key={acte.id} acte={acte} />
            ) : (
              <Contree key={acte.id} acte={acte} />
            ),
          )
        )}
      </View>
    </ScrollView>
  )
}

function Brume({ acte }: { acte: ActeCarte }) {
  return (
    <View style={[styles.bandeau, { backgroundColor: couleurs.bleuNuit }]}>
      <Icone sf="lock.fill" material="lock" taille={18} couleur="#5f7ba3" />
      <Text style={[typographie.etiquette, styles.bandeauTitre, { color: couleurs.blanc }]}>
        {t('carte.acte', { acte: chiffreRomain(acte.ordre), titre: acte.titre })}
      </Text>
      <Text style={[typographie.etiquette, { color: couleurs.encre2 }]}>
        {t('carte.sousLaBrume')}
      </Text>
    </View>
  )
}

function ActeTraverse({ acte }: { acte: ActeCarte }) {
  const router = useRouter()
  const faits = acte.etapes.filter((e) => e.statut === 'validee').length
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('carte.acte', { acte: chiffreRomain(acte.ordre), titre: acte.titre })}
      onPress={() => router.push(`/acte/${acte.id}`)}
    >
      <View style={[styles.bandeau, { backgroundColor: couleurs.or }]}>
        <View style={styles.coche}>
          <Icone sf="checkmark" material="check" taille={12} couleur={couleurs.or} />
        </View>
        <Text style={[typographie.etiquette, styles.bandeauTitre, { color: couleurs.bleuNuit }]}>
          {t('carte.acte', { acte: chiffreRomain(acte.ordre), titre: acte.titre })}
        </Text>
        <Text style={[typographie.etiquette, { color: '#7a4d00' }]}>
          {t('carte.traverse', { faits, total: acte.etapes.length })}
        </Text>
      </View>
    </Pressable>
  )
}

/** The current act: a land with the winding path and one node per step. */
function Contree({ acte }: { acte: ActeCarte }) {
  const [largeur, setLargeur] = useState(0)
  const points = disposerNoeuds(acte.etapes.length, largeur)
  const indexCourant = acte.etapes.findIndex((e) => e.statut === 'disponible')
  const finFait = indexCourant === -1 ? points.length : indexCourant + 1
  const hauteur = hauteurCarte(acte.etapes.length)

  return (
    <View
      onLayout={(e) => setLargeur(e.nativeEvent.layout.width)}
      style={[styles.contree, { height: hauteur, backgroundColor: couleurs.bleuDoux }]}
    >
      <View
        style={[
          styles.rond,
          {
            width: 160,
            height: 160,
            top: -30,
            right: -40,
            backgroundColor: 'rgba(255, 189, 89, 0.18)',
          },
        ]}
      />
      <View
        style={[
          styles.rond,
          {
            width: 180,
            height: 180,
            bottom: -50,
            left: -30,
            backgroundColor: 'rgba(17, 77, 168, 0.08)',
          },
        ]}
      />
      <View style={styles.contreeTitres}>
        <Text style={[typographie.etiquette, styles.majuscules, { color: '#4a7fd4' }]}>
          {t('carte.enCoursMajuscules', { acte: chiffreRomain(acte.ordre) })}
        </Text>
        <Text style={[typographie.titreCarte, { color: couleurs.bleu }]}>
          {acte.sous_titre ?? acte.titre}
        </Text>
      </View>
      {largeur > 0 && points.length > 0 ? (
        <>
          <Svg width={largeur} height={hauteur} style={StyleSheet.absoluteFill}>
            <Path
              d={tracer(points)}
              stroke="#aebfdd"
              strokeWidth={5}
              strokeLinecap="round"
              strokeDasharray="1 14"
              fill="none"
            />
            <Path
              d={tracer(points.slice(0, finFait))}
              stroke={couleurs.or}
              strokeWidth={5}
              strokeLinecap="round"
              fill="none"
            />
          </Svg>
          {acte.etapes.map((etape, i) => {
            const p = points[i]
            return p ? (
              <Noeud key={etape.id} etape={etape} x={p.x} y={p.y} largeur={largeur} />
            ) : null
          })}
        </>
      ) : acte.etapes.length === 0 ? (
        <Text style={[typographie.corps, styles.vide, { color: couleurs.encre }]}>
          {t('carte.vide')}
        </Text>
      ) : null}
    </View>
  )
}

function Noeud({
  etape,
  x,
  y,
  largeur,
}: {
  etape: EtapeCarte
  x: number
  y: number
  largeur: number
}) {
  const router = useRouter()
  const destination = destinationNoeud(etape)
  const courant = etape.statut === 'disponible'
  const fait = etape.statut === 'validee'
  const rayon = courant ? RAYON_COURANT : RAYON_NOEUD
  const ouvrir = () => {
    if (destination === 'aucune') return
    router.push(destination === 'rattrapage' ? `/defi/${etape.id}/rattrapage` : `/defi/${etape.id}`)
  }
  return (
    <View style={[styles.noeud, { left: gaucheEtiquette(x, largeur), top: y - rayon, width: 180 }]}>
      <Pressable
        accessibilityRole={destination === 'aucune' ? undefined : 'button'}
        accessibilityLabel={etape.defi.titre}
        disabled={destination === 'aucune'}
        onPress={ouvrir}
        style={[
          styles.pastille,
          { width: rayon * 2, height: rayon * 2, borderRadius: rayon },
          courant
            ? styles.pastilleCourante
            : fait
              ? styles.pastilleFaite
              : styles.pastilleVerrouillee,
        ]}
      >
        {courant ? (
          <View style={styles.glyphe}>
            <View style={styles.glypheHaut} />
            <View style={styles.glypheBas} />
            <Bulle taille="petite" style={styles.bulleNoeud} />
          </View>
        ) : fait ? (
          <Icone sf="checkmark" material="check" taille={18} couleur={couleurs.bleuNuit} />
        ) : (
          <Icone sf="lock.fill" material="lock" taille={16} couleur="#b0bccf" />
        )}
      </Pressable>
      <View style={styles.etiquette}>
        <Text
          numberOfLines={1}
          style={[
            typographie.etiquette,
            { color: fait || courant ? couleurs.bleuNuit : couleurs.encre2 },
          ]}
        >
          {etape.defi.titre}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  contenu: { paddingBottom: 120 },
  sections: { paddingHorizontal: espaces.xl, gap: espaces.s },
  bloc: { gap: espaces.m },
  bandeau: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaces.s,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: rayons.xxl,
  },
  bandeauTitre: { flex: 1, fontSize: 13.5, letterSpacing: 0 },
  coche: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: couleurs.bleuNuit,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contree: { borderRadius: 24, overflow: 'hidden' },
  rond: { position: 'absolute', borderRadius: 100 },
  contreeTitres: { position: 'absolute', top: 14, left: 18, gap: 2 },
  majuscules: { textTransform: 'uppercase', letterSpacing: 1 },
  vide: { padding: espaces.l, paddingTop: 64 },
  noeud: { position: 'absolute', alignItems: 'center', gap: 7 },
  pastille: { alignItems: 'center', justifyContent: 'center' },
  pastilleCourante: {
    backgroundColor: couleurs.orange,
    borderWidth: 7,
    borderColor: '#ffe0cc',
    shadowColor: couleurs.orange,
    shadowOpacity: 0.42,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  pastilleFaite: {
    backgroundColor: couleurs.or,
    shadowColor: '#d99b32',
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 4 },
  },
  pastilleVerrouillee: {
    backgroundColor: couleurs.blanc,
    shadowColor: '#d8dee9',
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 4 },
  },
  glyphe: { alignItems: 'center', gap: 2 },
  glypheHaut: { width: 11, height: 17, borderRadius: 6, backgroundColor: couleurs.blanc },
  glypheBas: { width: 17, height: 3, borderRadius: 2, backgroundColor: couleurs.blanc },
  bulleNoeud: { position: 'absolute', left: 48, top: -26 },
  etiquette: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: rayons.pilule,
    backgroundColor: couleurs.blanc,
    maxWidth: 170,
    shadowColor: couleurs.bleuNuit,
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
})
