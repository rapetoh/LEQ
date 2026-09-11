import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Bulle } from '@/components/Bulle'
import { EcranChargement } from '@/components/EcransEtat'
import { Bouton } from '@/components/ui/Bouton'
import { Carte } from '@/components/ui/Carte'
import { Titre } from '@/components/ui/Titre'
import { t } from '@/i18n/fr'
import {
  chargerPaire,
  invaliderArene,
  messageRefus,
  voter,
  type PaireAVoter,
} from '@/services/arene'
import { useConfiguration } from '@/services/configuration'
import { lecteur, urlSignee } from '@/services/lecture'
import { supabase } from '@/services/supabase'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, typographie } from '@/theme/tokens'

// C7 · Le vote, par paires. Two voices, you choose one, next pair. Anonymous until your vote;
// never your own take, never the same pair twice. Made to be repeated ten times.

type Etat =
  | { phase: 'chargement' }
  | { phase: 'paire'; paire: Extract<PaireAVoter, { raison: 'ok' }>; numero: number }
  | { phase: 'fini'; raison: 'parle_d_abord' | 'rien_a_comparer' | 'aucun_sujet' }
  | { phase: 'erreur'; message: string }

export default function Voter() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const clientRequetes = useQueryClient()
  const configuration = useConfiguration()
  const points = configuration.data?.points_par_vote ?? 5
  const [etat, setEtat] = useState<Etat>({ phase: 'chargement' })
  const [gagnes, setGagnes] = useState(0)
  const [enCours, setEnCours] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  const suivante = useCallback(async (numero: number, premier = false) => {
    if (!premier) setEtat({ phase: 'chargement' })
    try {
      const paire = await chargerPaire()
      if (paire.raison === 'ok') setEtat({ phase: 'paire', paire, numero })
      else setEtat({ phase: 'fini', raison: paire.raison })
    } catch (erreur) {
      setEtat({ phase: 'erreur', message: messageRefus(erreur) })
    }
  }, [])

  useEffect(() => {
    // The first pair is drawn after the first paint: the screen already shows its waiting state.
    const minuteur = setTimeout(() => void suivante(1, true), 0)
    return () => {
      clearTimeout(minuteur)
      lecteur.arreter()
    }
  }, [suivante])

  const ecouter = async (priseId: string) => {
    try {
      const { data } = await supabase
        .from('prises_publiques')
        .select('chemin_audio')
        .eq('id', priseId)
        .maybeSingle()
      const chemin = (data as { chemin_audio?: string | null } | null)?.chemin_audio
      if (!chemin) return
      setEnCours(priseId)
      await lecteur.jouer(await urlSignee(chemin), () => setEnCours(null))
    } catch (erreur) {
      console.warn('arène: lecture impossible', erreur)
      setEnCours(null)
    }
  }

  const choisir = async (gagnante: string, perdante: string, numero: number) => {
    setEnvoi(true)
    lecteur.arreter()
    try {
      await voter(gagnante, perdante)
      setGagnes((courants) => courants + points)
      invaliderArene(clientRequetes)
      await suivante(numero + 1)
    } catch (erreur) {
      setEtat({ phase: 'erreur', message: messageRefus(erreur) })
    } finally {
      setEnvoi(false)
    }
  }

  if (etat.phase === 'chargement') return <EcranChargement />

  return (
    <ScrollView
      style={{ backgroundColor: theme.fond }}
      contentContainerStyle={[
        styles.contenu,
        { paddingTop: insets.top + espaces.xl, paddingBottom: insets.bottom + espaces.xl },
      ]}
    >
      {etat.phase === 'paire' ? (
        <>
          <View style={styles.ligne}>
            <Text style={[typographie.etiquette, { color: theme.texteTertiaire, flex: 1 }]}>
              {t('arene.paire', { numero: etat.numero })}
            </Text>
            {gagnes > 0 ? (
              <Text style={[typographie.etiquette, { color: theme.accent }]}>
                {t('arene.pointsGagnes', { points: gagnes })}
              </Text>
            ) : null}
          </View>
          <Titre niveau="ecran">{etat.paire.sujet.texte}</Titre>
          <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>
            {t('arene.anonymes')}
          </Text>
          {[etat.paire.a, etat.paire.b].map((prise, index) => (
            <Carte key={prise.id} teinte={index === 0 ? 'voix' : 'douce'} style={styles.bloc}>
              <Text style={[typographie.titreCarte, { color: theme.texte }]}>
                {index === 0 ? 'A' : 'B'}
              </Text>
              <Bouton
                libelle={enCours === prise.id ? t('commun.chargement') : t('commun.continuer')}
                variante="secondaire"
                onPress={() => void ecouter(prise.id)}
              />
              <Bouton
                libelle={t('arene.choisir')}
                chargement={envoi}
                onPress={() =>
                  void choisir(
                    prise.id,
                    prise.id === etat.paire.a.id ? etat.paire.b.id : etat.paire.a.id,
                    etat.numero,
                  )
                }
              />
            </Carte>
          ))}
        </>
      ) : (
        <View style={styles.centre}>
          <Bulle taille="moyenne" visage="sourit" />
          <Titre niveau="ecran" centre>
            {etat.phase === 'erreur'
              ? t('erreurs.generique')
              : etat.raison === 'parle_d_abord'
                ? t('arene.parleDAbordTitre')
                : etat.raison === 'aucun_sujet'
                  ? t('arene.aucunSujetTitre')
                  : t('arene.rienAComparerTitre')}
          </Titre>
          <Text style={[typographie.corps, styles.centreTexte, { color: theme.texteSecondaire }]}>
            {etat.phase === 'erreur'
              ? etat.message
              : etat.raison === 'parle_d_abord'
                ? t('arene.parleDAbordCorps')
                : etat.raison === 'aucun_sujet'
                  ? t('arene.aucunSujetCorps')
                  : t('arene.rienAComparerCorps')}
          </Text>
          {gagnes > 0 ? (
            <Text style={[typographie.corpsFort, { color: theme.accent }]}>
              {t('arene.pointsGagnes', { points: gagnes })}
            </Text>
          ) : null}
        </View>
      )}

      <View style={styles.actions}>
        <Bouton libelle={t('commun.retour')} variante="texte" onPress={() => router.back()} />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  contenu: { flexGrow: 1, paddingHorizontal: espaces.xl, gap: espaces.m },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espaces.s },
  bloc: { gap: espaces.s },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: espaces.m },
  centreTexte: { textAlign: 'center' },
  actions: { marginTop: 'auto', paddingTop: espaces.l },
})
