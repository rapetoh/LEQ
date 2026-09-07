import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Bulle } from '@/components/Bulle'
import { Bouton } from '@/components/ui/Bouton'
import { Carte } from '@/components/ui/Carte'
import { Icone, type NomMaterial, type NomSF } from '@/components/ui/Icone'
import { Titre } from '@/components/ui/Titre'
import { t } from '@/i18n/fr'
import { useDemarrage } from '@/services/configuration'
import { demanderMicro } from '@/services/micro'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, rayons, typographie } from '@/theme/tokens'

// A2 · Le micro, le contrat. Three promises before the system prompt.

const PROMESSES: { texte: string; sf: NomSF; material: NomMaterial }[] = [
  { texte: t('accueil.micro.promesse1'), sf: 'waveform', material: 'graphic-eq' },
  { texte: t('accueil.micro.promesse2'), sf: 'hand.raised.fill', material: 'pan-tool' },
  { texte: t('accueil.micro.promesse3'), sf: 'trash.fill', material: 'delete' },
]

export default function Micro() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { marquerAccueilTermine } = useDemarrage()
  const [enCours, setEnCours] = useState(false)
  const [refuse, setRefuse] = useState(false)

  const systeme = Platform.OS === 'ios' ? 'iOS' : 'Android'

  // Granted or not, the flow goes on: A4 asks again before recording when needed.
  const terminer = () => {
    router.push('/accueil/questions')
  }
  const sansMicro = () => {
    marquerAccueilTermine()
    router.replace('/(onglets)/aujourdhui')
  }

  const activerMicro = async () => {
    setEnCours(true)
    try {
      const etat = await demanderMicro()
      if (etat === 'accorde') {
        terminer()
      } else {
        setRefuse(true)
      }
    } catch {
      setRefuse(true)
    } finally {
      setEnCours(false)
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
      <Bulle taille="moyenne" visage="sourit" style={styles.bulle} />
      <Titre niveau="ecran">{t('accueil.micro.titre')}</Titre>

      <View style={styles.promesses}>
        {PROMESSES.map((promesse) => (
          <Carte key={promesse.sf} style={styles.promesse}>
            <View style={[styles.pastille, { backgroundColor: theme.voixDoux }]}>
              <Icone
                sf={promesse.sf}
                material={promesse.material}
                taille={22}
                couleur={theme.texte}
              />
            </View>
            <Text style={[typographie.corps, styles.promesseTexte, { color: theme.texte }]}>
              {promesse.texte}
            </Text>
          </Carte>
        ))}
      </View>

      <View style={styles.actions}>
        {refuse ? (
          <>
            <Text style={[typographie.corps, styles.note, { color: theme.texteSecondaire }]}>
              {t('accueil.micro.refuse')}
            </Text>
            <Bouton
              libelle={t('accueil.micro.ouvrirReglages')}
              onPress={() => void Linking.openSettings()}
            />
            <Bouton
              libelle={t('accueil.micro.continuerSansMicro')}
              variante="texte"
              onPress={sansMicro}
            />
          </>
        ) : (
          <>
            <Bouton
              libelle={t('accueil.micro.activer')}
              chargement={enCours}
              onPress={() => void activerMicro()}
            />
            <Text style={[typographie.petit, styles.note, { color: theme.texteTertiaire }]}>
              {t('accueil.micro.note', { systeme })}
            </Text>
          </>
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  contenu: { flexGrow: 1, paddingHorizontal: espaces.xl, gap: espaces.l },
  bulle: { alignSelf: 'flex-start' },
  promesses: { gap: espaces.s, marginTop: espaces.xs },
  promesse: { flexDirection: 'row', alignItems: 'center', gap: espaces.m },
  pastille: {
    width: 44,
    height: 44,
    borderRadius: rayons.m,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promesseTexte: { flex: 1 },
  actions: { marginTop: 'auto', gap: espaces.s, paddingTop: espaces.l },
  note: { textAlign: 'center' },
})
