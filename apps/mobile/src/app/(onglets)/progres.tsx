import { formaterDureeLongue, type ResumeProgres } from '@leq/domaine'
import { useRouter } from 'expo-router'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useEspaceBarreOnglets } from '@/components/BarreOnglets'
import { Bulle } from '@/components/Bulle'
import { EcranChargement, EcranErreur } from '@/components/EcransEtat'
import { Bouton } from '@/components/ui/Bouton'
import { Carte } from '@/components/ui/Carte'
import { Degrade } from '@/components/ui/Degrade'
import { Icone } from '@/components/ui/Icone'
import { Titre } from '@/components/ui/Titre'
import { formaterEntier } from '@/app/(onglets)/moi'
import { t } from '@/i18n/fr'
import { useActualisation } from '@/services/actualisation'
import { useResumeProgres, useVoix, type Voix } from '@/services/progres'
import {
  arrondir,
  dateCourte,
  evolutionAppuis,
  initialeJour,
  moinsDAppuis,
  positionDebit,
  zoneDebit,
} from '@/services/progresVue'
import { ilYA } from '@/services/rythme'
import { useTheme } from '@/theme/ThemeProvider'
import { couleurs, espaces, polices, rayons, typographie } from '@/theme/tokens'

// D1 · Progrès and D1b, its continuation, laid out as the mockup draws them: the profile in
// motion on a gradient card, the week, the month in three numbers on one card, the voices of
// the grid this month against last month, the crutch words, the pace, before and now. Counts
// and measures, never a note on the voice. X1 stays until the first analysed take: nothing to
// show means no zeros, and a card that has nothing to show is not shown.

export default function Progres() {
  const resume = useResumeProgres()
  if (resume.isPending) return <EcranChargement />
  if (resume.isError) {
    return <EcranErreur message={t('progres.erreur')} reessayer={() => void resume.refetch()} />
  }
  if (!resume.data.premiere || !resume.data.derniere) return <PremierJour />
  return <Progression resume={resume.data} />
}

function Progression({ resume }: { resume: ResumeProgres }) {
  const theme = useTheme()
  const { enCours: actualisation, actualiser } = useActualisation()
  const insets = useSafeAreaInsets()
  const espaceBarre = useEspaceBarreOnglets()
  const router = useRouter()
  const voix = useVoix()
  const { serie, mois, premiere, derniere } = resume
  const appuis = evolutionAppuis(resume.bequilles_semaines)
  const debit = derniere?.debit ?? null
  const memePrise = premiere?.enregistre_le === derniere?.enregistre_le

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
      {/* The profile in motion: the pace of the last take, and where it sits. */}
      <View style={styles.heroOmbre}>
        <View style={styles.hero}>
          <Degrade de={couleurs.bleu} a={couleurs.bleuNuit} rayon={rayons.hero} id="progres" />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.heroEtiquette}>{t('progres.surtitre')}</Text>
            <Text style={styles.heroTitre}>
              {debit !== null
                ? t('progres.debit.valeur', { debit: arrondir(debit) })
                : t('progres.titre')}
            </Text>
            {debit !== null ? (
              <Text style={styles.heroCorps}>{t(`progres.debit.${zoneDebit(debit)}`)}</Text>
            ) : null}
          </View>
          <Bulle taille="petite" calme visage="sourit" />
        </View>
      </View>

      {/* The week. */}
      <Carte style={styles.carte}>
        <View style={styles.enteteCarte}>
          <Text style={[styles.etiquette, { color: theme.texteSecondaire }]}>
            {t('progres.semaine.titre')}
          </Text>
          <Text style={[styles.etiquette, { color: couleurs.rouge }]}>
            {serie.courante === 1
              ? t('progres.semaine.detailUn', { record: serie.record })
              : serie.courante > 0
                ? t('progres.semaine.detail', { jours: serie.courante, record: serie.record })
                : t('progres.semaine.recordSeul', { record: serie.record })}
          </Text>
        </View>
        <View style={styles.jours}>
          {serie.semaine.map((jour) => (
            <View key={jour.jour} style={styles.jour}>
              <View style={styles.flamme}>
                {jour.actif ? (
                  <Icone
                    sf="flame.fill"
                    material="local-fire-department"
                    taille={22}
                    couleur={couleurs.orange}
                  />
                ) : (
                  <View style={[styles.pointEteint, { backgroundColor: theme.carteDouce }]} />
                )}
              </View>
              <Text style={[styles.initiale, { color: theme.texteTertiaire }]}>
                {initialeJour(jour.jour)}
              </Text>
            </View>
          ))}
        </View>
      </Carte>

      {/* The month in three numbers, on one card. */}
      <Carte style={styles.chiffres}>
        <Chiffre
          valeur={formaterDureeLongue(mois.duree_parole_s)}
          libelle={t('progres.mois.parole')}
        />
        <View style={[styles.filetVertical, { backgroundColor: theme.bordure }]} />
        <Chiffre
          valeur={String(mois.prises)}
          libelle={mois.prises === 1 ? t('progres.mois.prise') : t('progres.mois.prises')}
        />
        <View style={[styles.filetVertical, { backgroundColor: theme.bordure }]} />
        <Chiffre
          valeur={String(mois.defis_releves)}
          libelle={mois.defis_releves === 1 ? t('progres.mois.defi') : t('progres.mois.defis')}
        />
      </Carte>

      {/* The voices of the grid, this month against last month. Only once a take was scored. */}
      {voix.data && voix.data.length > 0 ? (
        <Carte style={styles.carte}>
          <View style={styles.enteteCarte}>
            <Text style={[styles.etiquette, { color: theme.texteSecondaire }]}>
              {t('progres.voix.titre')}
            </Text>
            <Text style={[styles.sousEtiquette, { color: theme.texteSecondaire }]}>
              {t('progres.voix.sousTitre')}
            </Text>
          </View>
          <View style={{ gap: 13 }}>
            {voix.data.map((v) => (
              <BarreVoix key={v.cle} voix={v} />
            ))}
          </View>
        </Carte>
      ) : null}

      <Carte style={styles.carte}>
        <View style={styles.enteteCarte}>
          <Text style={[styles.etiquette, { color: theme.texteSecondaire }]}>
            {t('progres.appuis.titre')}
          </Text>
          <Text style={[styles.sousEtiquette, { color: theme.texteSecondaire }]}>
            {t('progres.appuis.sousTitre')}
          </Text>
        </View>
        {appuis.length === 0 ? (
          <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
            {t('progres.appuis.aucun')}
          </Text>
        ) : (
          appuis.map((appui) => (
            <View key={appui.mot} style={styles.ligne}>
              <Text style={[styles.mot, { color: theme.texte, flex: 1 }]}>« {appui.mot} »</Text>
              <Text style={[styles.mot, { color: theme.texte }]}>
                {t('progres.appuis.evolution', { avant: appui.avant, apres: appui.apres })}
              </Text>
            </View>
          ))
        )}
        <Text style={[styles.note, { color: theme.texteTertiaire }]}>
          {t('progres.appuis.note')}
          {moinsDAppuis(appuis) ? ` ${t('progres.appuis.moins')}` : ''}
        </Text>
      </Carte>

      {debit !== null ? (
        <Carte teinte="voix" style={styles.carte}>
          <Text style={[styles.etiquette, { color: theme.texteSecondaire }]}>
            {t('progres.debit.titre')}
          </Text>
          <Text style={[typographie.chiffre, { color: theme.texte }]}>
            {t('progres.debit.valeur', { debit: arrondir(debit) })}
          </Text>
          <View style={[styles.barre, { backgroundColor: theme.carte }]}>
            <View
              style={[
                styles.zone,
                {
                  backgroundColor: theme.voix,
                  left: `${positionDebit(130) * 100}%`,
                  width: `${(positionDebit(150) - positionDebit(130)) * 100}%`,
                },
              ]}
            />
            <View
              style={[
                styles.curseur,
                { backgroundColor: theme.texte, left: `${positionDebit(debit) * 100}%` },
              ]}
            />
          </View>
          <View style={styles.ligne}>
            {(['pose', 'zone', 'presse'] as const).map((zone) => (
              <Text
                key={zone}
                style={[
                  styles.sousEtiquette,
                  {
                    flex: 1,
                    textAlign: zone === 'pose' ? 'left' : zone === 'zone' ? 'center' : 'right',
                  },
                  { color: zoneDebit(debit) === zone ? theme.texte : theme.texteTertiaire },
                ]}
              >
                {t(`progres.debit.${zone}`)}
              </Text>
            ))}
          </View>
        </Carte>
      ) : null}

      {premiere && derniere ? (
        <Carte style={styles.carte}>
          <Text style={[styles.etiquette, { color: theme.texteSecondaire }]}>
            {t('progres.mesures.titre')}
          </Text>
          {memePrise ? (
            <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
              {t('progres.mesures.unePrise')}
            </Text>
          ) : (
            <>
              <View style={styles.ligne}>
                <View style={{ flex: 1 }} />
                <Text
                  style={[styles.sousEtiquette, styles.colonne, { color: theme.texteTertiaire }]}
                >
                  {dateCourte(premiere.enregistre_le)}
                </Text>
                <Text
                  style={[styles.sousEtiquette, styles.colonne, { color: theme.texteTertiaire }]}
                >
                  {ilYA(derniere.enregistre_le)}
                </Text>
              </View>
              <Mesure
                libelle={t('progres.mesures.debit')}
                avant={arrondir(premiere.debit)}
                apres={arrondir(derniere.debit)}
              />
              <Mesure
                libelle={t('progres.mesures.bequilles')}
                avant={arrondir(premiere.bequilles_par_minute, 1)}
                apres={arrondir(derniere.bequilles_par_minute, 1)}
              />
              <Mesure
                libelle={t('progres.mesures.silences')}
                avant={arrondir(premiere.silences_tenus)}
                apres={arrondir(derniere.silences_tenus)}
              />
            </>
          )}
        </Carte>
      ) : null}

      <Carte teinte="orange" style={styles.carte}>
        <Text style={[styles.etiquette, { color: theme.texteSecondaire }]}>
          {t('recompenses.titre')}
        </Text>
        <Text style={[typographie.chiffre, { color: theme.texte }]}>
          {formaterEntier(resume.points.solde)}
        </Text>
        <Bouton libelle={t('progres.recompenses')} onPress={() => router.push('/recompenses')} />
      </Carte>
    </ScrollView>
  )
}

/** One axis of the grid: its name, how it moved since last month, and where it stands. */
function BarreVoix({ voix }: { voix: Voix }) {
  const theme = useTheme()
  const delta = voix.precedent === null ? null : voix.mois - voix.precedent
  const sens: 'hausse' | 'baisse' | 'stable' | 'nouveau' =
    delta === null ? 'nouveau' : delta >= 2 ? 'hausse' : delta <= -2 ? 'baisse' : 'stable'
  const couleur =
    sens === 'hausse' ? theme.lien : sens === 'baisse' ? couleurs.rouge : couleurs.encre2
  const texte =
    sens === 'hausse'
      ? t('progres.voix.hausse', { n: delta ?? 0 })
      : sens === 'baisse'
        ? t('progres.voix.baisse', { n: delta ?? 0 })
        : sens === 'stable'
          ? t('progres.voix.stable')
          : t('progres.voix.nouveau')
  return (
    <View style={{ gap: 5 }}>
      <View style={styles.enteteCarte}>
        <Text style={[styles.mot, { color: theme.texte }]}>{voix.nom}</Text>
        <View style={styles.delta}>
          {sens === 'hausse' || sens === 'baisse' ? (
            <Icone
              sf={sens === 'hausse' ? 'arrowtriangle.up.fill' : 'arrowtriangle.down.fill'}
              material={sens === 'hausse' ? 'arrow-drop-up' : 'arrow-drop-down'}
              taille={12}
              couleur={couleur}
            />
          ) : null}
          <Text style={[styles.deltaTexte, { color: couleur }]}>{texte}</Text>
        </View>
      </View>
      <View style={[styles.jauge, { backgroundColor: theme.carteDouce }]}>
        <View
          style={[
            styles.jaugePleine,
            {
              width: `${Math.max(2, Math.min(100, voix.mois))}%`,
              backgroundColor:
                sens === 'baisse'
                  ? couleurs.rouge
                  : sens === 'stable'
                    ? couleurs.encre2
                    : theme.lien,
            },
          ]}
        />
      </View>
    </View>
  )
}

function Chiffre({ valeur, libelle }: { valeur: string; libelle: string }) {
  const theme = useTheme()
  return (
    <View style={styles.chiffre}>
      <Text style={[styles.chiffreValeur, { color: theme.texte }]}>{valeur}</Text>
      <Text style={[styles.chiffreLibelle, { color: theme.texteSecondaire }]}>{libelle}</Text>
    </View>
  )
}

function Mesure({ libelle, avant, apres }: { libelle: string; avant: string; apres: string }) {
  const theme = useTheme()
  return (
    <View style={styles.ligne}>
      <Text style={[typographie.corps, { color: theme.texteSecondaire, flex: 1 }]}>{libelle}</Text>
      <Text style={[typographie.corpsFort, styles.colonne, { color: theme.texteTertiaire }]}>
        {avant}
      </Text>
      <Text style={[typographie.corpsFort, styles.colonne, { color: theme.texte }]}>{apres}</Text>
    </View>
  )
}

/** X1 · Progrès, the first day: the page says what will appear here and offers a first take. */
function PremierJour() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const espaceBarre = useEspaceBarreOnglets()
  return (
    <ScrollView
      style={{ backgroundColor: theme.fond }}
      contentContainerStyle={[
        styles.vide,
        { paddingTop: insets.top + espaces.xxl, paddingBottom: espaceBarre },
      ]}
    >
      <Bulle taille="moyenne" visage="sourit" style={styles.bulle} />
      <Titre niveau="ecran" centre>
        {t('progres.vide.titre')}
      </Titre>
      <Text style={[typographie.corps, styles.corps, { color: theme.texteSecondaire }]}>
        {t('progres.vide.corps')}
      </Text>
      <View style={styles.apercus}>
        <Apercu libelle={t('progres.vide.apercuDebit')} teinte={couleurs.bleuDoux} />
        <Apercu libelle={t('progres.vide.apercuBequilles')} teinte={couleurs.orangeDoux} />
      </View>
      <Bouton
        libelle={t('progres.vide.action')}
        style={styles.action}
        onPress={() => router.push('/accueil/micro')}
      />
    </ScrollView>
  )
}

function Apercu({ libelle, teinte }: { libelle: string; teinte: string }) {
  const theme = useTheme()
  return (
    <Carte style={styles.apercu}>
      <View
        style={[styles.apercuTuile, { backgroundColor: theme.sombre ? theme.carteDouce : teinte }]}
      />
      <Text style={[styles.apercuTexte, { color: theme.texteSecondaire, flex: 1 }]}>{libelle}</Text>
    </Carte>
  )
}

const styles = StyleSheet.create({
  contenu: { paddingHorizontal: espaces.xl, gap: 14 },
  heroOmbre: {
    borderRadius: rayons.hero,
    shadowColor: couleurs.bleu,
    shadowOpacity: 0.28,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: espaces.l,
    borderRadius: rayons.hero,
    overflow: 'hidden',
  },
  heroEtiquette: {
    fontFamily: polices.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: couleurs.or,
  },
  heroTitre: {
    fontFamily: polices.extraBold,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.7,
    color: couleurs.blanc,
  },
  heroCorps: { fontFamily: polices.medium, fontSize: 12.5, lineHeight: 18, color: couleurs.encre3 },
  carte: { gap: espaces.s, paddingVertical: 18, paddingHorizontal: espaces.l },
  enteteCarte: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: espaces.s,
  },
  etiquette: {
    fontFamily: polices.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  sousEtiquette: { fontFamily: polices.bold, fontSize: 11, lineHeight: 14 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espaces.s },
  jours: { flexDirection: 'row', justifyContent: 'space-between', gap: espaces.xs },
  jour: { flex: 1, alignItems: 'center', gap: 6 },
  flamme: { height: 24, alignItems: 'center', justifyContent: 'flex-end' },
  pointEteint: { width: 10, height: 10, borderRadius: 5 },
  initiale: { fontFamily: polices.bold, fontSize: 10.5, lineHeight: 14 },
  chiffres: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: espaces.m,
    paddingHorizontal: 18,
  },
  chiffre: { flex: 1, alignItems: 'center', gap: 2 },
  chiffreValeur: {
    fontFamily: polices.extraBold,
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: -0.4,
  },
  chiffreLibelle: { fontFamily: polices.bold, fontSize: 10.5, lineHeight: 14, textAlign: 'center' },
  filetVertical: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  mot: { fontFamily: polices.bold, fontSize: 13.5, lineHeight: 18 },
  delta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deltaTexte: { fontFamily: polices.extraBold, fontSize: 11.5, lineHeight: 15 },
  jauge: { height: 7, borderRadius: rayons.pilule, overflow: 'hidden' },
  jaugePleine: { height: 7, borderRadius: rayons.pilule },
  note: { fontFamily: polices.medium, fontSize: 12.5, lineHeight: 18 },
  barre: { height: 10, borderRadius: rayons.pilule, overflow: 'visible', marginTop: espaces.xs },
  zone: { position: 'absolute', top: 0, bottom: 0, borderRadius: rayons.pilule },
  curseur: { position: 'absolute', top: -4, width: 4, height: 18, borderRadius: 2, marginLeft: -2 },
  colonne: { width: 72, textAlign: 'right' },
  vide: { flexGrow: 1, paddingHorizontal: espaces.xl, alignItems: 'center', gap: espaces.m },
  bulle: { marginBottom: espaces.s },
  corps: { textAlign: 'center', maxWidth: 320 },
  apercus: {
    alignSelf: 'stretch',
    gap: espaces.xs,
    marginTop: espaces.l,
    maxWidth: 300,
    width: '100%',
  },
  apercu: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: rayons.m,
  },
  apercuTuile: { width: 22, height: 22, borderRadius: 8 },
  apercuTexte: { fontFamily: polices.bold, fontSize: 12.5, lineHeight: 17 },
  action: { alignSelf: 'stretch', marginTop: 'auto' },
})
