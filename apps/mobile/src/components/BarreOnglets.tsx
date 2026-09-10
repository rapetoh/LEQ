import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Icone, type NomMaterial, type NomSF } from '@/components/ui/Icone'
import { useTheme } from '@/theme/ThemeProvider'
import { couleurs, espaces, polices, rayons } from '@/theme/tokens'

// The tab bar of the mockup: a floating pill centred at the bottom, round icons, and the
// current tab opened into a bleu nuit pill with its icon in "or" and its name.

export type DefinitionOnglet = { nom: string; titre: string; sf: NomSF; material: NomMaterial }

type Route = { key: string; name: string }
type Props = {
  state: { index: number; routes: Route[] }
  navigation: {
    emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => {
      defaultPrevented: boolean
    }
    navigate: (nom: string) => void
  }
  onglets: readonly DefinitionOnglet[]
}

export function BarreOnglets({ state, navigation, onglets }: Props) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const routeCourante = state.routes[state.index]?.name
  return (
    <View
      pointerEvents="box-none"
      style={[styles.zone, { paddingBottom: insets.bottom + espaces.xs }]}
    >
      <View
        style={[
          styles.pilule,
          {
            backgroundColor: theme.sombre ? 'rgba(13, 42, 78, 0.94)' : 'rgba(250, 248, 244, 0.94)',
          },
        ]}
      >
        {onglets.map((onglet) => {
          const route = state.routes.find((r) => r.name === onglet.nom)
          if (!route) return null
          const actif = routeCourante === onglet.nom
          const aller = () => {
            const evenement = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            })
            if (!actif && !evenement.defaultPrevented) navigation.navigate(onglet.nom)
          }
          return (
            <Pressable
              key={onglet.nom}
              accessibilityRole="tab"
              accessibilityState={{ selected: actif }}
              accessibilityLabel={onglet.titre}
              onPress={aller}
              style={[
                styles.onglet,
                actif && { backgroundColor: couleurs.bleuNuit, paddingHorizontal: 14 },
              ]}
            >
              <Icone
                sf={onglet.sf}
                material={onglet.material}
                taille={20}
                couleur={actif ? couleurs.or : theme.sombre ? couleurs.encre3 : couleurs.encre}
              />
              {actif ? <Text style={styles.libelle}>{onglet.titre}</Text> : null}
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  zone: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  pilule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    padding: 7,
    borderRadius: rayons.pilule,
    shadowColor: couleurs.bleuNuit,
    shadowOpacity: 0.28,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  onglet: {
    height: 42,
    minWidth: 42,
    borderRadius: rayons.pilule,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espaces.xs,
  },
  libelle: { fontFamily: polices.extraBold, fontSize: 12.5, color: couleurs.blanc },
})
