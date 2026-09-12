import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { useEspaceBarreOnglets } from '@/components/BarreOnglets'
import { CartePlaceholder } from '@/components/CartePlaceholder'
import { EnteteEcran } from '@/components/EnteteEcran'
import { Bouton } from '@/components/ui/Bouton'
import { Carte } from '@/components/ui/Carte'
import { Titre } from '@/components/ui/Titre'
import { t } from '@/i18n/fr'
import {
  jourDuSujet,
  useClassement,
  useDernierSujetClos,
  useDuels,
  useMaPrise,
  useSujet,
} from '@/services/arene'
import { useConfiguration, useDrapeaux } from '@/services/configuration'
import { minutesDe } from '@/services/rythme'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, rayons, typographie } from '@/theme/tokens'

// C1 to C4 · L'Arène. Two toggles at the top: the subject of the moment, and the duels. The
// subject runs seven days: you speak, you listen, you vote. The others stay veiled until you
// have spoken yourself. The duels are private and their verdict comes from the analysis.

type Onglet = 'sujet' | 'duels'

export default function Arene() {
  const theme = useTheme()
  const espaceBarre = useEspaceBarreOnglets()
  const drapeaux = useDrapeaux()
  const duelsActifs = drapeaux.data?.duels === true
  const [onglet, setOnglet] = useState<Onglet>('sujet')

  return (
    <ScrollView style={{ backgroundColor: theme.fond }} contentContainerStyle={[styles.contenu, { paddingBottom: espaceBarre }]}>
      <EnteteEcran titre={t('arene.titre')} />
      <View style={styles.sections}>
        {duelsActifs ? (
          <View style={[styles.bascule, { backgroundColor: theme.carteDouce }]}>
            {(['sujet', 'duels'] as const).map((cle) => {
              const actif = onglet === cle
              return (
                <Pressable
                  key={cle}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: actif }}
                  onPress={() => setOnglet(cle)}
                  style={[styles.onglet, actif && { backgroundColor: theme.carte }]}
                >
                  <Text
                    style={[
                      typographie.corpsFort,
                      { color: actif ? theme.texte : theme.texteSecondaire },
                    ]}
                  >
                    {cle === 'sujet' ? t('arene.sujetDuMoment') : t('arene.mesDuels')}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        ) : null}
        {onglet === 'sujet' ? <Sujet /> : <Duels />}
      </View>
    </ScrollView>
  )
}

/** C1, C2, C3: the subject, then what you can do with it depending on whether you have spoken. */
function Sujet() {
  const theme = useTheme()
  const router = useRouter()
  const configuration = useConfiguration()
  const sujet = useSujet()
  const maPrise = useMaPrise(sujet.data?.id ?? null)
  const classement = useClassement()
  const jours = configuration.data?.duree_sujet_arene_jours ?? 7
  const points = configuration.data?.points_par_vote ?? 5

  if (sujet.isPending) {
    return (
      <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
        {t('commun.chargement')}
      </Text>
    )
  }
  if (!sujet.data) {
    return (
      <Carte teinte="douce" style={styles.bloc}>
        <Text style={[typographie.titreCarte, { color: theme.texte }]}>
          {t('arene.aucunSujetTitre')}
        </Text>
        <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
          {t('arene.aucunSujetCorps')}
        </Text>
      </Carte>
    )
  }

  const parle = maPrise.data !== null && maPrise.data !== undefined
  const lignes = classement.data?.classement ?? []

  return (
    <>
      <Carte teinte="sombre" style={styles.bloc}>
        <View style={styles.ligne}>
          <Text style={[typographie.etiquette, styles.majuscules, { color: theme.voix, flex: 1 }]}>
            {t('arene.sujetSemaine')}
          </Text>
          <Text style={[typographie.etiquette, { color: theme.heroTexteSecondaire }]}>
            {t('arene.jour', { jour: jourDuSujet(sujet.data, jours), total: jours })}
          </Text>
        </View>
        <Titre niveau="section" surFondSombre>
          {sujet.data.texte}
        </Titre>
        {sujet.data.consigne ? (
          <Text style={[typographie.corps, { color: theme.heroTexteSecondaire }]}>
            {sujet.data.consigne}
          </Text>
        ) : null}
      </Carte>

      {!parle ? (
        <Carte style={styles.bloc}>
          <Bouton
            libelle={t('arene.enregistrer', { minutes: minutesDe(sujet.data.duree_max_s) })}
            onPress={() => router.push('/arene/prise')}
          />
          <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>
            {t('arene.conservation')}
          </Text>
        </Carte>
      ) : (
        <>
          <Carte teinte="voix" style={styles.bloc}>
            <Text style={[typographie.titreCarte, { color: theme.texte }]}>
              {maPrise.data?.statut === 'publiee'
                ? t('arene.passageDedans')
                : maPrise.data?.statut === 'retiree'
                  ? t('arene.passageRetire')
                  : t('arene.enModeration')}
            </Text>
            <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
              {maPrise.data?.statut === 'publiee'
                ? t('arene.passageDetail')
                : maPrise.data?.statut === 'retiree'
                  ? t('arene.passageRetireDetail')
                  : t('arene.enModerationDetail')}
            </Text>
          </Carte>
          <Carte teinte="orange" style={styles.bloc}>
            <Text
              style={[typographie.etiquette, styles.majuscules, { color: theme.texteSecondaire }]}
            >
              {t('arene.votesOuverts')}
            </Text>
            <Bouton
              libelle={t('arene.ecouterEtVoter', { points })}
              onPress={() => router.push('/arene/voter')}
            />
          </Carte>
        </>
      )}

      {lignes.length > 0 ? (
        <View style={styles.section}>
          <Titre niveau="section">{t('arene.classement')}</Titre>
          <Carte style={styles.liste}>
            {lignes.map((ligne, index) => (
              <View
                key={ligne.prise_id}
                style={[
                  styles.ligne,
                  styles.lignePadding,
                  index > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: theme.bordure,
                  },
                ]}
              >
                <Text style={[typographie.corpsFort, styles.rang, { color: theme.texteTertiaire }]}>
                  {ligne.rang}
                </Text>
                <Text style={[typographie.corpsFort, { color: theme.texte, flex: 1 }]}>
                  {ligne.moi ? t('arene.moi') : ligne.nom}
                </Text>
                <Text style={[typographie.petit, { color: theme.texteSecondaire }]}>
                  {ligne.votes === 1 ? t('arene.voteUn') : t('arene.votes', { votes: ligne.votes })}
                </Text>
              </View>
            ))}
          </Carte>
        </View>
      ) : null}

      <PodiumPasse />
    </>
  )
}

/** C8 entry: the week that just closed, one tap away, as long as one has closed. */
function PodiumPasse() {
  const theme = useTheme()
  const router = useRouter()
  const dernier = useDernierSujetClos()
  const sujet = dernier.data
  if (!sujet) return null
  return (
    <Carte teinte="sombre" style={styles.bloc}>
      <Text style={[typographie.etiquette, styles.majuscules, { color: theme.voix }]}>
        {t('arene.podiumSurtitre')}
      </Text>
      <Text style={[typographie.corps, { color: theme.heroTexteSecondaire }]}>{sujet.texte}</Text>
      <Bouton
        libelle={t('arene.podiumEntree')}
        variante="secondaire"
        onPress={() => router.push(`/arene/podium/${sujet.id}`)}
      />
    </Carte>
  )
}

/** C4: the duels in progress and the finished ones. */
function Duels() {
  const theme = useTheme()
  const router = useRouter()
  const clientRequetes = useQueryClient()
  const duels = useDuels()
  void clientRequetes

  if (duels.isPending) {
    return (
      <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
        {t('commun.chargement')}
      </Text>
    )
  }
  const liste = duels.data ?? []
  const enCours = liste.filter((d) => d.statut === 'ouvert')
  const passes = liste.filter((d) => d.statut !== 'ouvert')

  return (
    <>
      <Bouton libelle={t('arene.defier')} onPress={() => router.push('/duel/nouveau')} />
      {liste.length === 0 ? (
        <CartePlaceholder phrase={t('arene.duelsAucun')} />
      ) : (
        <>
          {enCours.length > 0 ? (
            <View style={styles.section}>
              <Titre niveau="section">{t('arene.duelsEnCours')}</Titre>
              {enCours.map((duel) => (
                <LigneDuel key={duel.id} duel={duel} />
              ))}
            </View>
          ) : null}
          {passes.length > 0 ? (
            <View style={styles.section}>
              <Titre niveau="section">{t('arene.duelsPasses')}</Titre>
              {passes.map((duel) => (
                <LigneDuel key={duel.id} duel={duel} />
              ))}
            </View>
          ) : null}
        </>
      )}
      <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>
        {t('arene.verdictAutomatique')}
      </Text>
    </>
  )
}

function LigneDuel({ duel }: { duel: import('@leq/domaine').Duel }) {
  const theme = useTheme()
  const router = useRouter()
  const etat =
    duel.statut === 'clos'
      ? t('arene.verdictPret')
      : duel.statut === 'expire'
        ? t('arene.duelExpire')
        : duel.invite_id === null
          ? t('arene.attenteReponse')
          : t('arene.aToiDeParler')
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(`/duel/${duel.id}`)}>
      <Carte style={[styles.ligne, styles.bloc]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[typographie.corpsFort, { color: theme.texte }]}>{duel.sujet}</Text>
          <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>{etat}</Text>
        </View>
        <Text style={[typographie.etiquette, { color: theme.lien }]}>{t('arene.voir')}</Text>
      </Carte>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  contenu: {},
  sections: { paddingHorizontal: espaces.xl, gap: espaces.m },
  section: { gap: espaces.s },
  bloc: { gap: espaces.s },
  liste: { paddingVertical: 0 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espaces.s },
  lignePadding: { paddingVertical: espaces.m },
  rang: { width: 22 },
  majuscules: { textTransform: 'uppercase', letterSpacing: 1 },
  bascule: { flexDirection: 'row', padding: 4, borderRadius: rayons.pilule },
  onglet: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: espaces.xs,
    borderRadius: rayons.pilule,
  },
})
