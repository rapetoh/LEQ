import { render } from '@testing-library/react-native'

import OngletsLayout from '@/app/(onglets)/_layout'
import { useDrapeaux } from '@/services/configuration'
import { FournisseurTheme } from '@/theme/ThemeProvider'

// The layout decides which tabs exist; expo-router's Tabs is replaced by a flat list that
// renders a tab's title unless href is null, which is how expo-router removes a tab.
jest.mock('expo-router', () => {
  const React = require('react')
  const { Text, View } = require('react-native')
  const Tabs = ({ children }: { children: React.ReactNode }) => <View>{children}</View>
  Tabs.Screen = ({
    name,
    options,
  }: {
    name: string
    options?: { title?: string; href?: unknown }
  }) => (options?.href === null ? null : <Text>{options?.title ?? name}</Text>)
  return { Tabs }
})

jest.mock('@/components/ui/Icone', () => ({ Icone: () => null }))

jest.mock('@/services/configuration', () => ({ useDrapeaux: jest.fn() }))

const useDrapeauxMock = useDrapeaux as jest.Mock

async function rendre(arene: boolean) {
  useDrapeauxMock.mockReturnValue({
    data: { arene, duels: false, face_a_face: false },
    isPending: false,
    isError: false,
  })
  return render(
    <FournisseurTheme>
      <OngletsLayout />
    </FournisseurTheme>,
  )
}

describe('OngletsLayout', () => {
  it('shows four tabs and no Arena tab while drapeaux.arene is off', async () => {
    const ecran = await rendre(false)
    expect(ecran.queryByText("L'Arène")).toBeNull()
    expect(ecran.getByText("Aujourd'hui")).toBeTruthy()
    expect(ecran.getByText('Défis')).toBeTruthy()
    expect(ecran.getByText('Progrès')).toBeTruthy()
    expect(ecran.getByText('Moi')).toBeTruthy()
  })

  it('adds the Arena tab in second position when drapeaux.arene is on', async () => {
    const ecran = await rendre(true)
    const libelles = ["Aujourd'hui", "L'Arène", 'Défis', 'Progrès', 'Moi']
    for (const libelle of libelles) expect(ecran.getByText(libelle)).toBeTruthy()
    const ordre = libelles.map((libelle) => ecran.getByText(libelle))
    expect(ordre.map((noeud) => noeud.props.children)).toEqual(libelles)
  })
})
