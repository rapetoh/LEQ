import { Tabs } from 'expo-router'

import { BarreOnglets, type DefinitionOnglet } from '@/components/BarreOnglets'
import { t } from '@/i18n/fr'
import { useDrapeaux } from '@/services/configuration'
import { useTheme } from '@/theme/ThemeProvider'

// Bottom tabs: Aujourd'hui, L'Arène (only when the flag is on, per mockup C0), Défis, Progrès, Moi.
// The bar itself is the mockup's floating pill (components/BarreOnglets.tsx).

const ONGLETS: DefinitionOnglet[] = [
  { nom: 'aujourdhui', titre: t('onglets.aujourdhui'), sf: 'house.fill', material: 'home' },
  { nom: 'arene', titre: t('onglets.arene'), sf: 'flame.fill', material: 'local-fire-department' },
  { nom: 'defis', titre: t('onglets.defis'), sf: 'flag.fill', material: 'flag' },
  { nom: 'progres', titre: t('onglets.progres'), sf: 'diamond.fill', material: 'show-chart' },
  { nom: 'moi', titre: t('onglets.moi'), sf: 'person.fill', material: 'person' },
]

export default function OngletsLayout() {
  const theme = useTheme()
  const drapeaux = useDrapeaux()
  const areneActive = drapeaux.data?.arene === true
  const visibles = ONGLETS.filter((o) => o.nom !== 'arene' || areneActive)

  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: theme.fond } }}
      tabBar={(props) => (
        <BarreOnglets state={props.state} navigation={props.navigation} onglets={visibles} />
      )}
    >
      {ONGLETS.map((onglet) => (
        <Tabs.Screen
          key={onglet.nom}
          name={onglet.nom}
          options={{
            title: onglet.titre,
            ...(onglet.nom === 'arene' && !areneActive ? { href: null } : {}),
          }}
        />
      ))}
    </Tabs>
  )
}
