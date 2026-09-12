import { formaterDureeLongue, type ResumeProgres } from '@leq/domaine'
import { useRouter } from 'expo-router'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useEspaceBarreOnglets } from '@/components/BarreOnglets'
import { Bulle } from '@/components/Bulle'
import { CartePlaceholder } from '@/components/CartePlaceholder'
import { EcranChargement, EcranErreur } from '@/components/EcransEtat'
import { EnteteEcran } from '@/components/EnteteEcran'
import { Bouton } from '@/components/ui/Bouton'
import { Carte } from '@/components/ui/Carte'
import { Icone } from '@/components/ui/Icone'
import { Titre } from '@/components/ui/Titre'
import { formaterEntier } from '@/app/(onglets)/moi'
import { t } from '@/i18n/fr'
import { useResumeProgres } from '@/services/progres'
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
import { espaces, rayons, typographie } from '@/theme/tokens'

// D1 · Progrès and D1b, its continuation. The profile in motion, the week, the month in three
// numbers, the crutch words, the pace, before and now. Counts and measures, never a note on
// the voice; the five voices and the month's heading wait for Rebecca's grid. X1 stays until
// the first analysed take: nothing to show means no zeros.

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
  const espaceBarre = useEspaceBarreOnglets()
  const router = useRouter()
  const { serie, mois, premiere, derniere } = resume
  const appuis = evolutionAppuis(resume.bequilles_semaines)
  const debit = derniere?.debit ?? null
  const memePrise = premiere?.enregistre_le === derniere?.enregistre_le

  return (
    <ScrollView style={{ backgroundColor: theme.fond }} contentContainerStyle={[styles.contenu, { paddingBottom: espaceBarre }]}>
      <EnteteEcran surtitre={t('progres.surtitre')} titre={t('progres.titre')} />
      <View style={styles.sections}>
        <Carte style={styles.bloc}>
          <View style={styles.ligne}>
            <Text style={[typographie.titreCarte, { color: theme.texte, flex: 1 }]}>
              {t('progres.semaine.titre')}
            </Text>
            <Text style={[typographie.petit, { color: theme.texteSecondaire }]}>
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
                <View
                  style={[
                    styles.point,
                    { backgroundColor: jour.actif ? theme.voix : theme.carteDouce },
                  ]}
                >
                  {jour.actif ? (
                    <Icone
                      sf="flame.fill"
                      material="local-fire-department"
                      taille={12}
                      couleur={theme.accent}
                    />
                  ) : null}
                </View>
                <Text style={[typographie.etiquette, { color: theme.texteTertiaire }]}>
                  {initialeJour(jour.jour)}
                </Text>
              </View>
            ))}
          </View>
        </Carte>

        <View style={styles.tuiles}>
          <Tuile
            valeur={formaterDureeLongue(mois.duree_parole_s)}
            libelle={t('progres.mois.parole')}
          />
          <Tuile
            valeur={String(mois.prises)}
            libelle={mois.prises === 1 ? t('progres.mois.prise') : t('progres.mois.prises')}
          />
          <Tuile
            valeur={String(mois.defis_releves)}
            libelle={mois.defis_releves === 1 ? t('progres.mois.defi') : t('progres.mois.defis')}
          />
        </View>

        <CartePlaceholder titre={t('progres.voix.titre')} phrase={t('progres.voix.placeholder')} />

        <Carte style={styles.bloc}>
          <View style={styles.ligne}>
            <Text style={[typographie.titreCarte, { color: theme.texte, flex: 1 }]}>
              {t('progres.appuis.titre')}
            </Text>
            <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>
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
                <Text style={[typographie.corpsFort, { color: theme.texte, flex: 1 }]}>
                  « {appui.mot} »
                </Text>
                <Text style={[typographie.corpsFort, { color: theme.texte }]}>
                  {t('progres.appuis.evolution', { avant: appui.avant, apres: appui.apres })}
                </Text>
              </View>
            ))
          )}
          <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>
            {t('progres.appuis.note')}
            {moinsDAppuis(appuis) ? ` ${t('progres.appuis.moins')}` : ''}
          </Text>
        </Carte>

        {debit !== null ? (
          <Carte teinte="voix" style={styles.bloc}>
            <Text style={[typographie.titreCarte, { color: theme.texte }]}>
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
                    typographie.etiquette,
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
          <Carte style={styles.bloc}>
            <Text style={[typographie.titreCarte, { color: theme.texte }]}>
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
                    style={[typographie.etiquette, styles.colonne, { color: theme.texteTertiaire }]}
                  >
                    {dateCourte(premiere.enregistre_le)}
                  </Text>
                  <Text
                    style={[typographie.etiquette, styles.colonne, { color: theme.texteTertiaire }]}
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

        <CartePlaceholder titre={t('progres.cap.titre')} phrase={t('progres.cap.placeholder')} />

        <Carte teinte="orange" style={styles.bloc}>
          <Text
            style={[typographie.etiquette, styles.majuscules, { color: theme.texteSecondaire }]}
          >
            {t('recompenses.titre')}
          </Text>
          <Text style={[typographie.chiffre, { color: theme.texte }]}>
            {formaterEntier(resume.points.solde)}
          </Text>
          <Bouton libelle={t('progres.recompenses')} onPress={() => router.push('/recompenses')} />
        </Carte>
      </View>
    </ScrollView>
  )
}

function Tuile({ valeur, libelle }: { valeur: string; libelle: string }) {
  const theme = useTheme()
  return (
    <Carte style={styles.tuile}>
      <Text style={[typographie.titreSection, { color: theme.texte }]}>{valeur}</Text>
      <Text style={[typographie.petit, { color: theme.texteSecondaire }]}>{libelle}</Text>
    </Carte>
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
        <Apercu
          libelle={t('progres.vide.apercuDebit')}
          sf="waveform.path.ecg"
          material="show-chart"
        />
        <Apercu
          libelle={t('progres.vide.apercuBequilles')}
          sf="arrow.down.right"
          material="trending-down"
        />
      </View>
      <Bouton
        libelle={t('progres.vide.action')}
        style={styles.action}
        onPress={() => router.push('/accueil/micro')}
      />
    </ScrollView>
  )
}

function Apercu({
  libelle,
  sf,
  material,
}: {
  libelle: string
  sf: Parameters<typeof Icone>[0]['sf']
  material: Parameters<typeof Icone>[0]['material']
}) {
  const theme = useTheme()
  return (
    <Carte style={[styles.apercu, { borderColor: theme.bordure }]} teinte="transparente">
      <View style={[styles.apercuIcone, { backgroundColor: theme.voixDoux }]}>
        <Icone sf={sf} material={material} taille={20} couleur={theme.texte} />
      </View>
      <Text style={[typographie.corpsFort, { color: theme.texte, flex: 1 }]}>{libelle}</Text>
    </Carte>
  )
}

const styles = StyleSheet.create({
  contenu: {},
  sections: { paddingHorizontal: espaces.xl, gap: espaces.m },
  bloc: { gap: espaces.s },
  majuscules: { textTransform: 'uppercase' },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espaces.s },
  jours: { flexDirection: 'row', justifyContent: 'space-between' },
  jour: { alignItems: 'center', gap: espaces.xxs },
  point: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tuiles: { flexDirection: 'row', gap: espaces.xs },
  tuile: { flex: 1, gap: 2, paddingHorizontal: espaces.s, alignItems: 'center' },
  barre: { height: 10, borderRadius: rayons.pilule, overflow: 'visible', marginTop: espaces.xs },
  zone: { position: 'absolute', top: 0, bottom: 0, borderRadius: rayons.pilule },
  curseur: { position: 'absolute', top: -4, width: 4, height: 18, borderRadius: 2, marginLeft: -2 },
  colonne: { width: 72, textAlign: 'right' },
  vide: { flexGrow: 1, paddingHorizontal: espaces.xl, alignItems: 'center', gap: espaces.m },
  bulle: { marginBottom: espaces.s },
  corps: { textAlign: 'center', maxWidth: 320 },
  apercus: { alignSelf: 'stretch', gap: espaces.s, marginTop: espaces.l },
  apercu: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaces.m,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  apercuIcone: {
    width: 40,
    height: 40,
    borderRadius: rayons.s,
    alignItems: 'center',
    justifyContent: 'center',
  },
  action: { alignSelf: 'stretch', marginTop: 'auto' },
})
