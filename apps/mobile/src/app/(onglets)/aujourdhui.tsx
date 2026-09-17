import { useRouter } from 'expo-router'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { formaterEntier } from '@/app/(onglets)/moi'
import { useEspaceBarreOnglets } from '@/components/BarreOnglets'
import { Bouton } from '@/components/ui/Bouton'
import { Carte } from '@/components/ui/Carte'
import { Degrade } from '@/components/ui/Degrade'
import { Icone } from '@/components/ui/Icone'
import { PorteCompte } from '@/components/PorteCompte'
import { t } from '@/i18n/fr'
import { useActualisation } from '@/services/actualisation'
import { useEstAnonyme } from '@/services/compte'
import { jourDuSujet, useSujet } from '@/services/arene'
import { useDrapeaux } from '@/services/configuration'
import { nomFormule, useFormules } from '@/services/formules'
import { useEtapeDuJour, useRetour, useCarte } from '@/services/parcours'
import { useDerniereMesure, useProfil } from '@/services/profil'
import { usePoints, useSerie } from '@/services/progres'
import { useAteliers } from '@/services/rebecca'
import { etatAujourdhui, minutesDe, positionDefi, rythmeDeFormule } from '@/services/rythme'
import { useTheme } from '@/theme/ThemeProvider'
import { couleurs, espaces, polices, rayons, typographie } from '@/theme/tokens'

// B1 · Aujourd'hui, laid out as the mockup draws it: the greeting and the streak, the step of
// the day on the orange card (it IS the next step of the path, the dots say so), what to work
// on next beside the points, the week's subject, and what Rebecca offers this month. Nothing on
// this screen is a placeholder: a card that has nothing to show is not shown.

function dateDuJour(): string {
  const brut = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return brut.charAt(0).toUpperCase() + brut.slice(1)
}

export default function Aujourdhui() {
  const theme = useTheme()
  const { enCours: actualisation, actualiser } = useActualisation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const drapeaux = useDrapeaux()
  const areneActive = drapeaux.data?.arene === true
  const sujet = useSujet(areneActive)
  const serie = useSerie()
  const points = usePoints()
  const ateliers = useAteliers()
  const prochainAtelier = ateliers.data?.[0] ?? null
  const espaceBarre = useEspaceBarreOnglets()
  const profil = useProfil()
  const prenom = profil.data?.prenom?.trim()
  const derniere = useDerniereMesure()
  const retour = useRetour(derniere.data?.tentative_id ?? null)
  const axes = (retour.data?.evaluation?.axes_travail ?? [])
    .map((axe) => retour.data?.criteres[axe.critere] ?? null)
    .filter((nom): nom is string => nom !== null)
    .slice(0, 2)

  return (
    <ScrollView
      refreshControl={
        <RefreshControl
          refreshing={actualisation}
          onRefresh={() => void actualiser()}
          tintColor={theme.lien}
        />
      }
      style={{ backgroundColor: theme.fond }}
      contentContainerStyle={[
        styles.contenu,
        { paddingTop: insets.top + espaces.m, paddingBottom: espaceBarre },
      ]}
    >
      <View style={styles.entete}>
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={[styles.date, { color: theme.texteSecondaire }]}>{dateDuJour()}</Text>
          <Text style={[styles.salut, { color: theme.texte }]} numberOfLines={1}>
            {prenom ? t('aujourdhui.salutation', { prenom }) : t('aujourdhui.salutationSansPrenom')}
          </Text>
        </View>
        {serie.data ? (
          <View
            accessibilityLabel={`${serie.data.courante} ${t('aujourdhui.serieLibelle')}`}
            style={[
              styles.serie,
              {
                backgroundColor:
                  serie.data.courante > 0
                    ? theme.sombre
                      ? theme.carteDouce
                      : couleurs.orangeDoux
                    : theme.carteDouce,
              },
            ]}
          >
            <Icone
              sf="flame.fill"
              material="local-fire-department"
              taille={16}
              couleur={serie.data.courante > 0 ? couleurs.orange : theme.texteTertiaire}
            />
            <Text
              style={[
                styles.serieNombre,
                { color: serie.data.courante > 0 ? couleurs.rouge : theme.texteSecondaire },
              ]}
            >
              {t('aujourdhui.serieJours', { jours: serie.data.courante })}
            </Text>
          </View>
        ) : null}
      </View>

      <CarteDuJour />

      {/* What to work on next, from the last feedback, beside the points. */}
      <View style={styles.rangee}>
        {axes.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              derniere.data ? router.push(`/retour/${derniere.data.tentative_id}`) : undefined
            }
            style={{ flex: 1 }}
          >
            <Carte style={styles.conseil}>
              <Text style={[styles.etiquetteBleue, { color: theme.lien }]}>{t('retour.axes')}</Text>
              <Text style={[styles.conseilTexte, { color: theme.texte }]}>{axes.join(' · ')}</Text>
            </Carte>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('aujourdhui.mesRecompenses')}
          onPress={() => router.push('/recompenses')}
          style={axes.length > 0 ? styles.tuilePoints : { flex: 1 }}
        >
          <Carte style={[styles.points, axes.length === 0 && styles.pointsLarge]}>
            <Text style={[styles.pointsValeur, { color: theme.lien }]}>
              {points.data ? formaterEntier(points.data.solde) : '·'}
            </Text>
            <Text style={[styles.pointsLibelle, { color: theme.texteSecondaire }]}>
              {t('aujourdhui.pointsLibelle')}
            </Text>
            {axes.length === 0 && points.data ? (
              <Text style={[typographie.petit, { color: theme.texteSecondaire }]}>
                {points.data.cette_semaine > 0
                  ? t('aujourdhui.pointsSemaine', {
                      points: formaterEntier(points.data.cette_semaine),
                    })
                  : t('aujourdhui.pointsAucun')}
              </Text>
            ) : null}
          </Carte>
        </Pressable>
      </View>

      {areneActive ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/(onglets)/arene')}>
          <Carte style={styles.sujet}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.etiquetteRouge, { color: couleurs.rouge }]}>
                {sujet.data
                  ? `${t('aujourdhui.sujetSemaine')} · ${t('arene.jour', { jour: jourDuSujet(sujet.data), total: 7 })}`
                  : t('aujourdhui.sujetSemaine')}
              </Text>
              <Text style={[styles.sujetTexte, { color: theme.texte }]} numberOfLines={1}>
                {sujet.data ? `« ${sujet.data.texte} »` : t('aujourdhui.aucunSujet')}
              </Text>
            </View>
            <Icone
              sf="chevron.right"
              material="chevron-right"
              taille={16}
              couleur={theme.texteTertiaire}
            />
          </Carte>
        </Pressable>
      ) : (
        <Carte teinte="douce" style={{ gap: espaces.xs }}>
          <Text style={[typographie.titreCarte, { color: theme.texte }]}>
            {t('aujourdhui.areneBientotTitre')}
          </Text>
          <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
            {t('aujourdhui.areneBientot')}
          </Text>
        </Carte>
      )}

      <Carte style={styles.rebecca}>
        <View style={styles.rebeccaEntete}>
          <View
            style={[styles.portrait, { backgroundColor: theme.voixDoux, borderColor: couleurs.or }]}
          >
            <Text style={[styles.portraitLettre, { color: theme.texte }]}>R</Text>
          </View>
          <View style={{ flex: 1, gap: 1 }}>
            <Text style={[styles.rebeccaTitre, { color: theme.texte }]}>
              {t('aujourdhui.avecRebecca')}
            </Text>
            <Text
              style={[styles.rebeccaSousTitre, { color: theme.texteSecondaire }]}
              {...(prochainAtelier ? { numberOfLines: 1 } : {})}
            >
              {prochainAtelier
                ? [
                    prochainAtelier.titre,
                    prochainAtelier.places === null
                      ? null
                      : prochainAtelier.places === 1
                        ? t('rebecca.place')
                        : t('rebecca.places', { places: prochainAtelier.places }),
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : t('aujourdhui.placeholderRebecca')}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/aujourdhui/rebecca')}
            hitSlop={8}
          >
            <Text style={[styles.toutVoir, { color: theme.lien }]}>{t('aujourdhui.toutVoir')}</Text>
          </Pressable>
        </View>
        {prochainAtelier ? (
          <View style={styles.rebeccaActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/aujourdhui/rebecca')}
              style={({ pressed }) => [
                styles.petitBouton,
                { backgroundColor: couleurs.orange },
                pressed && styles.presse,
              ]}
            >
              <Text style={[styles.petitBoutonTexte, { color: couleurs.blanc }]}>
                {t('aujourdhui.garderPlace')}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/rebecca')}
              style={({ pressed }) => [
                styles.petitBouton,
                { backgroundColor: theme.carteDouce },
                pressed && styles.presse,
              ]}
            >
              <Text style={[styles.petitBoutonTexte, { color: theme.lien }]}>
                {t('rebecca.titre')}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </Carte>
    </ScrollView>
  )
}

/** The orange card: the step of the day in its five states. */
export function CarteDuJour() {
  const theme = useTheme()
  const router = useRouter()
  const jour = useEtapeDuJour()
  const anonyme = useEstAnonyme()
  const carte = useCarte()
  const compteAttendu =
    anonyme && (carte.data ?? []).some((acte) => acte.etapes.some((e) => e.statut === 'validee'))
  const formules = useFormules()

  if (jour.isPending) {
    return (
      <Carte teinte="orange" style={styles.defiAttente}>
        <Text style={[typographie.etiquette, { color: theme.texteSecondaire }]}>
          {t('aujourdhui.defiDuJour', { minutes: 2 })}
        </Text>
        <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
          {t('commun.chargement')}
        </Text>
      </Carte>
    )
  }

  if (jour.isError || !jour.data) {
    return (
      <Carte teinte="orange" style={styles.defiAttente}>
        <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
          {t('aujourdhui.erreurParcours')}
        </Text>
        <Bouton
          libelle={t('commun.reessayer')}
          variante="secondaire"
          onPress={() => void jour.refetch()}
        />
      </Carte>
    )
  }

  const donnees = jour.data
  const etat = etatAujourdhui(donnees)
  const rythme = t(`defi.${rythmeDeFormule(donnees.rythme.limite_etapes)}`)
  const formule = t('defi.formule', {
    formule: nomFormule(formules.data, donnees.formule),
    rythme,
  })
  const limitee = donnees.rythme.limite_etapes > 0

  if (etat.etat === 'defi' && donnees.etape && donnees.defi && donnees.acte) {
    const { etape, defi, acte } = donnees
    const position = positionDefi(acte, etape.ordre, etape.nb_etapes_acte)
    const cible = etat.rattrapage ? `/defi/${etape.id}/rattrapage` : `/defi/${etape.id}`
    const total = Math.min(etape.nb_etapes_acte, 12)
    return (
      <View style={styles.heroOmbre}>
        <View style={styles.hero}>
          <Degrade de={couleurs.orange} a={couleurs.orangeSombre} rayon={rayons.hero} id="feu" />
          <View style={styles.pilules}>
            <View style={styles.pilule}>
              <Text style={[styles.piluleTexte, { color: couleurs.blanc }]}>
                {t('aujourdhui.defiDuJour', { minutes: minutesDe(defi.duree_max_s) })}
              </Text>
            </View>
            <View style={styles.pilule}>
              <Text style={[styles.piluleTexte, { color: couleurs.or }]}>
                {t('aujourdhui.points', { points: defi.points })}
              </Text>
            </View>
          </View>
          <Text style={styles.heroTitre}>{defi.titre}</Text>
          <View style={styles.progression} accessibilityLabel={position.acte}>
            {total > 1 ? (
              <View style={styles.pointsActe}>
                {Array.from({ length: total }, (_v, i) => {
                  const ordre = i + 1
                  const courant = ordre === etape.ordre
                  const fait = ordre < etape.ordre
                  return (
                    <View
                      key={ordre}
                      style={[
                        styles.pointActe,
                        courant && styles.pointCourant,
                        {
                          backgroundColor: fait
                            ? couleurs.or
                            : courant
                              ? couleurs.blanc
                              : 'rgba(255, 255, 255, 0.35)',
                        },
                      ]}
                    />
                  )
                })}
              </View>
            ) : null}
            <Text style={[styles.positionTexte, { color: couleurs.orangeClair }]} numberOfLines={1}>
              {position.genre === 'derniere'
                ? t('defi.dernier', { acte: position.acte })
                : t('defi.positionCourte', position)}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityHint={defi.titre}
            onPress={() => router.push(cible)}
            style={({ pressed }) => [styles.lancer, pressed && styles.presse]}
          >
            <Text style={styles.lancerTexte}>{t('aujourdhui.jeMeLance')}</Text>
            <Icone sf="arrow.right" material="arrow-forward" taille={18} couleur={couleurs.rouge} />
          </Pressable>
          {compteAttendu ? <PorteCompte raison="parcours" surFondSombre /> : null}
          <View style={styles.bandeau}>
            <Text
              style={[styles.bandeauTexte, { color: couleurs.encreClair, flex: 1 }]}
              numberOfLines={1}
            >
              {formule}
            </Text>
            {limitee ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/defi/limite')}
                hitSlop={8}
              >
                <Text style={[styles.bandeauLien, { color: couleurs.or }]}>
                  {t('defi.enchainer')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    )
  }

  const textes = {
    limite_jour: { titre: t('defi.termine.titre'), corps: t('defi.termine.corps') },
    limite_essais: { titre: t('defi.essaisEpuises.titre'), corps: t('defi.essaisEpuises.corps') },
    parcours_termine: {
      titre: t('defi.parcoursTermine.titre'),
      corps: t('defi.parcoursTermine.corps'),
    },
    aucune_etape: { titre: t('defi.aucuneEtape.titre'), corps: t('defi.aucuneEtape.corps') },
  } as const
  const cle = etat.etat === 'defi' ? 'aucune_etape' : etat.etat
  const texte = textes[cle]

  return (
    <Carte teinte={cle === 'aucune_etape' ? 'douce' : 'orange'} style={styles.defiAttente}>
      <Text style={[typographie.titreCarte, { color: theme.texte }]}>{texte.titre}</Text>
      <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>{texte.corps}</Text>
      {cle === 'limite_jour' ? (
        <Bouton
          libelle={t('defi.enchainer')}
          variante="secondaire"
          onPress={() => router.push('/defi/limite')}
        />
      ) : null}
      {cle === 'limite_jour' || cle === 'limite_essais' ? (
        <Bouton
          libelle={t('aujourdhui.voirCarte')}
          variante="texte"
          onPress={() => router.push('/(onglets)/defis')}
        />
      ) : null}
      <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>{formule}</Text>
    </Carte>
  )
}

const styles = StyleSheet.create({
  contenu: { paddingHorizontal: espaces.xl, gap: 12 },
  presse: { opacity: 0.85 },
  entete: { flexDirection: 'row', alignItems: 'center', gap: espaces.s, marginBottom: 2 },
  date: { fontFamily: polices.semiBold, fontSize: 12, lineHeight: 16 },
  salut: { fontFamily: polices.extraBold, fontSize: 27, lineHeight: 32, letterSpacing: -0.75 },
  serie: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: espaces.xs,
    borderRadius: rayons.pilule,
  },
  serieNombre: { fontFamily: polices.extraBold, fontSize: 14, lineHeight: 18 },
  // The hero card of the day.
  // The glow sits on an outer view: a clipped view clips its own shadow on iOS.
  heroOmbre: {
    borderRadius: rayons.hero,
    shadowColor: couleurs.orange,
    shadowOpacity: 0.32,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  hero: {
    gap: 9,
    paddingVertical: 18,
    paddingHorizontal: espaces.l,
    borderRadius: rayons.hero,
    overflow: 'hidden',
  },
  defiAttente: { gap: espaces.m },
  pilules: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  pilule: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: rayons.pilule,
    backgroundColor: couleurs.bleuNuit,
  },
  piluleTexte: {
    textTransform: 'uppercase',
    fontFamily: polices.extraBold,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 0.95,
  },
  heroTitre: {
    fontFamily: polices.extraBold,
    fontSize: 25,
    lineHeight: 28,
    letterSpacing: -0.7,
    color: couleurs.blanc,
  },
  progression: { flexDirection: 'row', alignItems: 'center', gap: espaces.xs },
  pointsActe: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  pointActe: { width: 8, height: 8, borderRadius: 4 },
  pointCourant: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  positionTexte: { fontFamily: polices.extraBold, fontSize: 11.5, lineHeight: 16, flex: 1 },
  lancer: {
    height: 54,
    paddingHorizontal: espaces.l,
    borderRadius: rayons.l,
    backgroundColor: couleurs.blanc,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lancerTexte: {
    fontFamily: polices.extraBold,
    fontSize: 16,
    lineHeight: 20,
    color: couleurs.rouge,
  },
  bandeau: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: espaces.xs,
    paddingHorizontal: espaces.s,
    borderRadius: rayons.s,
    backgroundColor: couleurs.bleuNuit,
  },
  bandeauTexte: { fontFamily: polices.bold, fontSize: 12, lineHeight: 16 },
  bandeauLien: { fontFamily: polices.extraBold, fontSize: 12, lineHeight: 16 },
  // The row under the card.
  rangee: { flexDirection: 'row', gap: 10 },
  conseil: { flex: 1, gap: 5, paddingVertical: 13, paddingHorizontal: 15, borderRadius: rayons.xl },
  etiquetteBleue: {
    textTransform: 'uppercase',
    fontFamily: polices.extraBold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.8,
  },
  conseilTexte: { fontFamily: polices.semiBold, fontSize: 13, lineHeight: 18 },
  tuilePoints: { width: 96 },
  points: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 13,
    paddingHorizontal: espaces.xs,
    borderRadius: rayons.xl,
  },
  pointsLarge: { alignItems: 'flex-start', paddingHorizontal: espaces.m },
  pointsValeur: {
    fontFamily: polices.extraBold,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.4,
  },
  pointsLibelle: {
    textTransform: 'uppercase',
    fontFamily: polices.bold,
    fontSize: 9.5,
    lineHeight: 12,
    letterSpacing: 0.76,
  },
  sujet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaces.s,
    paddingVertical: espaces.s,
    paddingHorizontal: espaces.m,
    borderRadius: rayons.xl,
  },
  etiquetteRouge: {
    textTransform: 'uppercase',
    fontFamily: polices.extraBold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.8,
  },
  sujetTexte: { fontFamily: polices.bold, fontSize: 13.5, lineHeight: 18 },
  rebecca: { gap: 10, paddingVertical: 14, paddingHorizontal: espaces.m },
  rebeccaEntete: { flexDirection: 'row', alignItems: 'center', gap: espaces.s },
  portrait: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portraitLettre: { fontFamily: polices.extraBold, fontSize: 18, lineHeight: 22 },
  rebeccaTitre: { fontFamily: polices.extraBold, fontSize: 13.5, lineHeight: 18 },
  rebeccaSousTitre: { fontFamily: polices.semiBold, fontSize: 11.5, lineHeight: 15 },
  toutVoir: { fontFamily: polices.extraBold, fontSize: 11.5, lineHeight: 15 },
  rebeccaActions: { flexDirection: 'row', gap: 9 },
  petitBouton: {
    flex: 1,
    height: 44,
    borderRadius: rayons.m,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: espaces.s,
  },
  petitBoutonTexte: { fontFamily: polices.extraBold, fontSize: 13, lineHeight: 17 },
})
