import { randomUUID } from 'expo-crypto'
import { File } from 'expo-file-system'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Titre } from '@/components/ui/Titre'
import { enregistrement } from '@/services/enregistrement'
import { demanderMicro, lireEtatMicro } from '@/services/micro'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, typographie } from '@/theme/tokens'

// Development-only screen (EXPO_PUBLIC_ECRAN_INITIAL=/diagnostic): runs the whole recording
// chain and prints what each step answers, on screen and in the Metro log. It found the iOS
// encoder refusing 16 kHz on 2026-09-11. No route links to it.

const DUREE_TEST_MS = 3000

export default function Diagnostic() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const [lignes, setLignes] = useState<string[]>([])

  useEffect(() => {
    let actif = true
    const dire = (texte: string) => {
      console.log(`[diagnostic] ${texte}`)
      if (actif) setLignes((courantes) => [...courantes, texte])
    }
    void (async () => {
      try {
        dire(`état du micro : ${await lireEtatMicro()}`)
        const etat = await demanderMicro()
        dire(`après demande : ${etat}`)
        if (etat !== 'accorde') return dire('ARRÊT : micro refusé')

        const id = randomUUID()
        let niveaux = 0
        await enregistrement.demarrer(
          id,
          () => {
            niveaux += 1
          },
          () => dire('interruption reçue'),
        )
        dire('démarré')
        await new Promise((r) => setTimeout(r, DUREE_TEST_MS))
        dire(`durée vue : ${enregistrement.duree().toFixed(2)} s, ${niveaux} trames de niveau`)

        const prise = await enregistrement.arreter()
        const fichier = new File(prise.chemin)
        const taille = fichier.exists ? fichier.size : 0
        dire(`arrêté : ${prise.duree_s.toFixed(2)} s, ${taille} octets`)
        if (fichier.exists) fichier.delete()
        dire(taille > 0 ? 'OK : la chaîne d’enregistrement fonctionne' : 'ÉCHEC : fichier vide')
      } catch (erreur) {
        dire(`ÉCHEC : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
        await enregistrement.annuler().catch(() => undefined)
      }
    })()
    return () => {
      actif = false
    }
  }, [])

  return (
    <ScrollView
      style={{ backgroundColor: theme.fond }}
      contentContainerStyle={[styles.contenu, { paddingTop: insets.top + espaces.xl }]}
    >
      <Titre niveau="ecran">Diagnostic</Titre>
      {lignes.map((ligne, i) => (
        <Text key={`${i}-${ligne}`} style={[typographie.corps, { color: theme.texte }]}>
          {ligne}
        </Text>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  contenu: { paddingHorizontal: espaces.xl, paddingBottom: espaces.xxl, gap: espaces.xs },
})
