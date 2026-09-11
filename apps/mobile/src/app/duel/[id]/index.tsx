import type { Duel } from '@leq/domaine'
import { useQueryClient } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Bulle } from '@/components/Bulle'
import { EcranChargement, EcranErreur } from '@/components/EcransEtat'
import { Bouton } from '@/components/ui/Bouton'
import { Carte } from '@/components/ui/Carte'
import { Titre } from '@/components/ui/Titre'
import { t } from '@/i18n/fr'
import { useDuels } from '@/services/arene'
import { lecteur, urlSignee } from '@/services/lecture'
import { supabase, useSession } from '@/services/supabase'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, typographie } from '@/theme/tokens'

// C6 · Le duel, verdict. No votes here: the duel is private, the analysis decides on Rebecca's
// grid, and the screen says so. While it is open, the screen says whose turn it is.

type Passage = { id: string; utilisateur_id: string; chemin_audio: string | null }

export default function EcranDuel() {
  const params = useLocalSearchParams<{ id?: string }>()
  const id = typeof params.id === 'string' ? params.id : null
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { session } = useSession()
  const duels = useDuels()
  const clientRequetes = useQueryClient()
  const [passages, setPassages] = useState<Passage[]>([])
  void clientRequetes

  const duel: Duel | undefined = duels.data?.find((d) => d.id === id)

  useEffect(() => {
    if (!id) return
    let actif = true
    void supabase
      .from('prises_publiques')
      .select('id, utilisateur_id, chemin_audio')
      .eq('duel_id', id)
      .then(({ data }) => {
        if (actif && data) setPassages(data as Passage[])
      })
    return () => {
      actif = false
      lecteur.arreter()
    }
  }, [id])

  if (duels.isPending) return <EcranChargement />
  if (!duel) {
    return <EcranErreur message={t('arene.refusInconnu')} reessayer={() => void duels.refetch()} />
  }

  const moi = session?.user.id ?? ''
  const jeSuisInviteur = duel.inviteur_id === moi
  const gagne =
    duel.verdict === 'egalite'
      ? null
      : (duel.verdict === 'inviteur') === jeSuisInviteur
        ? true
        : false
  const maPrise = passages.find((p) => p.utilisateur_id === moi)
  const sienne = passages.find((p) => p.utilisateur_id !== moi)

  const ecouter = async (passage: Passage | undefined) => {
    if (!passage?.chemin_audio) return
    try {
      await lecteur.jouer(await urlSignee(passage.chemin_audio))
    } catch (erreur) {
      console.warn('duel: lecture impossible', erreur)
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.fond }}
      contentContainerStyle={[
        styles.contenu,
        { paddingTop: insets.top + espaces.xl, paddingBottom: insets.bottom + espaces.xl },
      ]}
    >
      <Text style={[typographie.etiquette, { color: theme.texteTertiaire }]}>
        {t('arene.mesDuels')}
      </Text>
      <Titre niveau="ecran">{duel.sujet}</Titre>

      {duel.statut === 'clos' ? (
        <>
          <View style={styles.centre}>
            <Bulle taille="moyenne" visage={gagne === true ? 'parle' : 'sourit'} />
            <Titre niveau="section" centre>
              {duel.verdict === 'egalite'
                ? t('arene.egalite')
                : gagne
                  ? t('arene.vainqueur')
                  : t('arene.verdictPret')}
            </Titre>
          </View>
          <Carte style={styles.bloc}>
            <Bouton
              libelle={t('commun.continuer')}
              variante="secondaire"
              onPress={() => void ecouter(maPrise)}
            />
            <Bouton
              libelle={t('arene.voir')}
              variante="secondaire"
              onPress={() => void ecouter(sienne)}
            />
          </Carte>
        </>
      ) : duel.statut === 'expire' ? (
        <Carte teinte="douce" style={styles.bloc}>
          <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
            {t('arene.duelExpire')}
          </Text>
        </Carte>
      ) : (
        <Carte teinte="douce" style={styles.bloc}>
          <Text style={[typographie.corpsFort, { color: theme.texte }]}>
            {maPrise ? t('arene.attenteReponse') : t('arene.aToiDeParler')}
          </Text>
          <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>
            {t('arene.duelDelai')}
          </Text>
          {!maPrise ? (
            <Bouton
              libelle={t('defi.pret')}
              onPress={() => router.push(`/duel/${duel.id}/prise`)}
            />
          ) : null}
        </Carte>
      )}

      <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>
        {t('arene.verdictAutomatique')}
      </Text>

      <View style={styles.actions}>
        <Bouton libelle={t('commun.retour')} variante="texte" onPress={() => router.back()} />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  contenu: { flexGrow: 1, paddingHorizontal: espaces.xl, gap: espaces.m },
  bloc: { gap: espaces.s },
  centre: { alignItems: 'center', gap: espaces.m },
  actions: { marginTop: 'auto', paddingTop: espaces.l },
})
