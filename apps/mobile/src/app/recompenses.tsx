import type { RecompenseBoutique } from '@leq/domaine'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { formaterEntier } from '@/app/(onglets)/moi'
import { EcranChargement, EcranErreur } from '@/components/EcransEtat'
import { Bouton } from '@/components/ui/Bouton'
import { Carte } from '@/components/ui/Carte'
import { Icone, type NomMaterial, type NomSF } from '@/components/ui/Icone'
import { Titre } from '@/components/ui/Titre'
import { t } from '@/i18n/fr'
import {
  ErreurEchange,
  echangerRecompense,
  invaliderProgres,
  useBoutique,
} from '@/services/progres'
import { ilYA } from '@/services/rythme'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, rayons, typographie } from '@/theme/tokens'

// D2 · Récompenses. Points are earned on every formula; the shop says what each reward costs
// and how many are left this month. The hour with Rebecca is a distinction, never a purchase.

export default function Recompenses() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const clientRequetes = useQueryClient()
  const boutique = useBoutique()
  const [message, setMessage] = useState<string | null>(null)

  const echange = useMutation({
    mutationFn: echangerRecompense,
    onSuccess: () => {
      setMessage(t('recompenses.fait'))
      invaliderProgres(clientRequetes)
    },
    onError: (erreur: Error) => {
      const refus = erreur instanceof ErreurEchange ? erreur.refus : null
      setMessage(t(`recompenses.refus.${refus ?? 'inconnu'}`))
      invaliderProgres(clientRequetes)
    },
  })

  if (boutique.isPending) return <EcranChargement />
  if (boutique.isError) {
    return (
      <EcranErreur message={t('recompenses.erreur')} reessayer={() => void boutique.refetch()} />
    )
  }
  const { points, recompenses, echanges } = boutique.data

  const confirmer = (recompense: RecompenseBoutique) => {
    if (recompense.cout_points === null) return
    Alert.alert(
      t('recompenses.confirmerTitre', { cout: formaterEntier(recompense.cout_points) }),
      t('recompenses.confirmerCorps', { titre: recompense.titre }),
      [
        { text: t('commun.retour'), style: 'cancel' },
        { text: t('recompenses.confirmer'), onPress: () => echange.mutate(recompense.id) },
      ],
    )
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.fond }}
      contentContainerStyle={[
        styles.contenu,
        { paddingTop: insets.top + espaces.m, paddingBottom: insets.bottom + espaces.xxl },
      ]}
    >
      <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.retour}>
        <Text style={[typographie.corpsFort, { color: theme.lien }]}>‹ {t('commun.retour')}</Text>
      </Pressable>

      <Carte teinte="orange" style={styles.solde}>
        <Text style={[typographie.etiquette, { color: theme.texteSecondaire }]}>
          {t('recompenses.titre')}
        </Text>
        <Text style={[typographie.titreHero, { color: theme.texte }]}>
          {formaterEntier(points.solde)}
        </Text>
        <View style={styles.ligne}>
          <Text style={[typographie.petit, { color: theme.texteSecondaire, flex: 1 }]}>
            {t('recompenses.formule', { formule: t(`formules.${points.formule}`) })}
          </Text>
          {points.cette_semaine > 0 ? (
            <Text style={[typographie.petit, { color: theme.texteSecondaire }]}>
              {t('recompenses.semaine', { points: formaterEntier(points.cette_semaine) })}
            </Text>
          ) : null}
        </View>
      </Carte>

      {message ? (
        <Text style={[typographie.corps, styles.message, { color: theme.texteSecondaire }]}>
          {message}
        </Text>
      ) : null}

      {recompenses.length === 0 ? (
        <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
          {t('recompenses.vide')}
        </Text>
      ) : (
        recompenses.map((recompense) => (
          <Recompense
            key={recompense.id}
            recompense={recompense}
            solde={points.solde}
            enCours={echange.isPending && echange.variables === recompense.id}
            onEchanger={() => confirmer(recompense)}
          />
        ))
      )}

      <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>
        {t('recompenses.note')}
      </Text>

      {echanges.length > 0 ? (
        <View style={styles.section}>
          <Titre niveau="section">{t('recompenses.historique')}</Titre>
          <Carte style={styles.liste}>
            {echanges.map((e, index) => (
              <View
                key={e.id}
                style={[
                  styles.ligne,
                  styles.lignePadding,
                  index > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: theme.bordure,
                  },
                ]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[typographie.corpsFort, { color: theme.texte }]}>{e.titre}</Text>
                  <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>
                    {t(`recompenses.statuts.${e.statut}`)} · {ilYA(e.cree_le)}
                  </Text>
                </View>
                <Text style={[typographie.corpsFort, { color: theme.texteSecondaire }]}>
                  {t('recompenses.cout', { cout: formaterEntier(e.cout_points) })}
                </Text>
              </View>
            ))}
          </Carte>
        </View>
      ) : null}
    </ScrollView>
  )
}

const ICONES: Record<RecompenseBoutique['type'], { sf: NomSF; material: NomMaterial }> = {
  contenu: { sf: 'play.rectangle.fill', material: 'play-circle-outline' },
  reduction: { sf: 'percent', material: 'percent' },
  atelier: { sf: 'person.3.fill', material: 'groups' },
  distinction: { sf: 'star.fill', material: 'star' },
}

function Recompense({
  recompense,
  solde,
  enCours,
  onEchanger,
}: {
  recompense: RecompenseBoutique
  solde: number
  enCours: boolean
  onEchanger: () => void
}) {
  const theme = useTheme()
  const cout = recompense.cout_points
  const distinction = recompense.type === 'distinction' || !recompense.echangeable || cout === null
  const epuisee = recompense.restantes_ce_mois !== null && recompense.restantes_ce_mois <= 0
  const atteint = !distinction && cout !== null && solde >= cout
  const restantes = recompense.restantes_ce_mois

  let etat: string
  if (distinction) etat = t('recompenses.distinction')
  else if (epuisee) etat = t('recompenses.plusDePlace')
  else if (atteint) etat = t('recompenses.atteint', { cout: formaterEntier(cout ?? 0) })
  else etat = t('recompenses.manque', { manque: formaterEntier((cout ?? 0) - solde) })

  return (
    <Carte
      teinte={distinction ? 'douce' : atteint && !epuisee ? 'voix' : 'carte'}
      style={styles.recompense}
    >
      <View style={styles.ligne}>
        <View style={[styles.tuile, { backgroundColor: theme.voixDoux }]}>
          <Icone
            sf={ICONES[recompense.type].sf}
            material={ICONES[recompense.type].material}
            taille={22}
            couleur={theme.texte}
          />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[typographie.titreCarte, { color: theme.texte }]}>{recompense.titre}</Text>
          {recompense.sous_titre ? (
            <Text style={[typographie.petit, { color: theme.texteSecondaire }]}>
              {recompense.sous_titre}
            </Text>
          ) : null}
        </View>
        {cout !== null && !distinction ? (
          <View style={[styles.pilule, { backgroundColor: theme.accentDoux }]}>
            <Text style={[typographie.etiquette, { color: theme.texte }]}>
              {t('recompenses.cout', { cout: formaterEntier(cout) })}
            </Text>
          </View>
        ) : null}
      </View>
      {!distinction && cout !== null ? (
        <View style={[styles.piste, { backgroundColor: '#FFE9C2' }]}>
          <View
            style={[
              styles.remplissage,
              {
                backgroundColor: theme.accent,
                width: `${Math.min(100, Math.round((solde / cout) * 100))}%`,
              },
            ]}
          />
        </View>
      ) : null}
      {recompense.description ? (
        <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
          {recompense.description}
        </Text>
      ) : null}
      <View style={styles.ligne}>
        <Text style={[typographie.petit, { color: theme.texteTertiaire, flex: 1 }]}>
          {etat}
          {restantes !== null && !epuisee
            ? ` · ${restantes === 1 ? t('recompenses.place') : t('recompenses.places', { restantes })}`
            : ''}
        </Text>
        {atteint && !epuisee ? (
          <Bouton libelle={t('recompenses.echanger')} chargement={enCours} onPress={onEchanger} />
        ) : null}
      </View>
      {recompense.provisoire ? (
        <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>
          {t('recompenses.provisoire')}
        </Text>
      ) : null}
    </Carte>
  )
}

const styles = StyleSheet.create({
  contenu: { paddingHorizontal: espaces.xl, gap: espaces.m },
  retour: { paddingVertical: espaces.xs, alignSelf: 'flex-start' },
  solde: { gap: espaces.xxs },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espaces.s },
  lignePadding: { paddingVertical: espaces.m },
  message: { textAlign: 'center' },
  recompense: { gap: espaces.s },
  tuile: {
    width: 46,
    height: 46,
    borderRadius: rayons.m,
    alignItems: 'center',
    justifyContent: 'center',
  },
  piste: { height: 5, borderRadius: rayons.pilule, overflow: 'hidden' },
  remplissage: { height: 5, borderRadius: rayons.pilule },
  pilule: {
    paddingHorizontal: espaces.s,
    paddingVertical: espaces.xxs,
    borderRadius: rayons.pilule,
  },
  section: { gap: espaces.s },
  liste: { paddingVertical: 0 },
})
