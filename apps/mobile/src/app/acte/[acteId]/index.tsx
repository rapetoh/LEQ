import { useLocalSearchParams, useRouter } from 'expo-router'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { EcranChargement, EcranErreur } from '@/components/EcransEtat'
import { Bouton } from '@/components/ui/Bouton'
import { Carte } from '@/components/ui/Carte'
import { Titre } from '@/components/ui/Titre'
import { Icone } from '@/components/ui/Icone'
import { t } from '@/i18n/fr'
import { useCarte, type EtapeCarte } from '@/services/parcours'
import { chiffreRomain, ilYA } from '@/services/rythme'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, typographie } from '@/theme/tokens'

// H4 · L'acte replié. The land won opens again: no replay (the voice is not kept), but
// the result of each validated step: the grid score when a grid existed, measures, date.

function formaterNote(valeur: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(valeur)
}

export default function ActeReplie() {
  const params = useLocalSearchParams<{ acteId?: string }>()
  const acteId = typeof params.acteId === 'string' ? params.acteId : null
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const carte = useCarte()

  if (carte.isPending) return <EcranChargement />
  if (carte.isError) {
    return <EcranErreur message={carte.error.message} reessayer={() => void carte.refetch()} />
  }
  const acte = carte.data.find((a) => a.id === acteId)
  if (!acte) {
    return <EcranErreur message={t('carte.introuvable')} reessayer={() => router.back()} />
  }
  const faits = acte.etapes.filter((e) => e.statut === 'validee').length
  const numero = chiffreRomain(acte.ordre)
  const etat =
    acte.statut === 'traverse'
      ? t('carte.traverseLong', { faits, total: acte.etapes.length })
      : acte.statut === 'en_cours'
        ? t('carte.enCours', { acte: numero })
        : t('carte.aVenir')

  return (
    <ScrollView
      style={{ backgroundColor: theme.fond }}
      contentContainerStyle={[
        styles.contenu,
        { paddingTop: insets.top + espaces.xl, paddingBottom: insets.bottom + espaces.xl },
      ]}
    >
      <Text style={[typographie.etiquette, { color: theme.texteTertiaire }]}>
        {t('carte.surtitreActe')}
      </Text>
      <Titre niveau="ecran">{t('carte.acte', { acte: numero, titre: acte.titre })}</Titre>
      <Text style={[typographie.petit, { color: theme.texteSecondaire }]}>{etat}</Text>

      <Carte style={styles.bloc}>
        {acte.etapes.map((etape) => (
          <Ligne key={etape.id} etape={etape} />
        ))}
      </Carte>

      <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>
        {t('carte.conservation')}
      </Text>

      <View style={styles.actions}>
        <Bouton libelle={t('commun.retour')} variante="secondaire" onPress={() => router.back()} />
      </View>
    </ScrollView>
  )
}

function Ligne({ etape }: { etape: EtapeCarte }) {
  const theme = useTheme()
  const resultat = etape.resultat
  const detail = resultat
    ? t('carte.detailResultat', {
        debit: resultat.mots_par_minute === null ? '·' : Math.round(resultat.mots_par_minute),
        bequilles: resultat.bequilles ?? '·',
        quand: ilYA(resultat.enregistre_le),
      })
    : etape.statut === 'validee'
      ? t('carte.sansGrille')
      : etape.statut === 'disponible'
        ? t('carte.ouvrir')
        : t('carte.verrouille')
  const note =
    resultat && resultat.note_totale !== null && resultat.note_max !== null
      ? t('carte.note', {
          note: formaterNote(resultat.note_totale),
          max: formaterNote(resultat.note_max),
        })
      : null

  return (
    <View style={styles.ligne}>
      <View
        style={[
          styles.rond,
          { backgroundColor: etape.statut === 'validee' ? theme.voix : theme.carteDouce },
        ]}
      >
        {etape.statut === 'validee' ? (
          <Icone sf="checkmark" material="check" taille={14} couleur={theme.texte} />
        ) : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[typographie.corpsFort, { color: theme.texte }]}>{etape.defi.titre}</Text>
        <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>{detail}</Text>
      </View>
      {note ? (
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[typographie.corpsFort, { color: theme.texte }]}>{note}</Text>
          <Text style={[typographie.etiquette, { color: theme.texteTertiaire }]}>
            {t('defi.resultat.grilleLibelle')}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  contenu: { flexGrow: 1, paddingHorizontal: espaces.xl, gap: espaces.m },
  bloc: { gap: espaces.m },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espaces.s },
  rond: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  actions: { marginTop: 'auto', gap: espaces.s, paddingTop: espaces.l },
})
