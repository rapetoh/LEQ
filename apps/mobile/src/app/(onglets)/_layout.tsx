import { Tabs } from 'expo-router'

import { Icone, type NomMaterial, type NomSF } from '@/components/ui/Icone'
import { t } from '@/i18n/fr'
import { useDrapeaux } from '@/services/configuration'
import { useTheme } from '@/theme/ThemeProvider'
import { polices } from '@/theme/tokens'

// Bottom tabs: Aujourd'hui, L'Arène (only when the flag is on, per mockup C0), Défis, Progrès, Moi.

type Onglet = { nom: string; titre: string; sf: NomSF; material: NomMaterial }

const ONGLETS: Onglet[] = [
  { nom: 'aujourdhui', titre: t('onglets.aujourdhui'), sf: 'sun.max.fill', material: 'wb-sunny' },
  { nom: 'arene', titre: t('onglets.arene'), sf: 'flame.fill', material: 'local-fire-department' },
  { nom: 'defis', titre: t('onglets.defis'), sf: 'map.fill', material: 'map' },
  {
    nom: 'progres',
    titre: t('onglets.progres'),
    sf: 'chart.line.uptrend.xyaxis',
    material: 'show-chart',
  },
  { nom: 'moi', titre: t('onglets.moi'), sf: 'person.fill', material: 'person' },
]

export default function OngletsLayout() {
  const theme = useTheme()
  const drapeaux = useDrapeaux()
  const areneActive = drapeaux.data?.arene === true

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.ongletActif,
        tabBarInactiveTintColor: theme.ongletInactif,
        tabBarStyle: {
          backgroundColor: theme.barreOnglets,
          borderTopColor: theme.barreOngletsBordure,
        },
        tabBarLabelStyle: { fontFamily: polices.semiBold, fontSize: 11 },
        sceneStyle: { backgroundColor: theme.fond },
      }}
    >
      {ONGLETS.map((onglet) => {
        const cache = onglet.nom === 'arene' && !areneActive
        return (
          <Tabs.Screen
            key={onglet.nom}
            name={onglet.nom}
            options={{
              title: onglet.titre,
              tabBarIcon: ({ color, size }) => (
                <Icone sf={onglet.sf} material={onglet.material} taille={size} couleur={color} />
              ),
              // href: null removes the tab from the bar entirely: no ghost tab.
              ...(cache ? { href: null } : {}),
            }}
          />
        )
      })}
    </Tabs>
  )
}
