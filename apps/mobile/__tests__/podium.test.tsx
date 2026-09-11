import { render } from '@testing-library/react-native'

import Podium from '@/app/arene/podium/[sujetId]'
import { usePodium } from '@/services/arene'
import { FournisseurTheme } from '@/theme/ThemeProvider'

// C8 · What the podium says at the end of a week. The screen holds no arithmetic (that lives in
// services/podiumVue and is tested there); what is checked here is what a person reads.

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ sujetId: 'sujet-1' }),
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

jest.mock('@/services/arene', () => ({
  usePodium: jest.fn(),
  messageRefus: () => 'refus',
}))

const usePodiumMock = usePodium as unknown as jest.Mock

function ligne(rang: number, options: Record<string, unknown> = {}) {
  return {
    rang,
    prise_id: `p${rang}`,
    votes: 10 - rang,
    moi: false,
    nom: `Voix ${rang}`,
    ...options,
  }
}

async function rendre(
  classement: unknown[],
  sujet: unknown = { texte: 'Faut-il encore apprendre par cœur ?' },
) {
  usePodiumMock.mockReturnValue({
    data: { sujet, classement: { sujet_id: 'sujet-1', classement } },
    isPending: false,
    isError: false,
  })
  return render(
    <FournisseurTheme>
      <Podium />
    </FournisseurTheme>,
  )
}

describe('the podium of a closed week', () => {
  it('shows the subject of the week it is about', async () => {
    const ecran = await rendre([ligne(1), ligne(2), ligne(3)])
    expect(ecran.getByText('Faut-il encore apprendre par cœur ?')).toBeTruthy()
    expect(ecran.getByText('Le podium')).toBeTruthy()
  })

  it('tells the person their place, counted against the whole week', async () => {
    const ecran = await rendre([ligne(1), ligne(2, { moi: true }), ligne(3), ligne(4)])
    expect(ecran.getByText('2e sur 4')).toBeTruthy()
    expect(ecran.getByText('8 voix pour toi')).toBeTruthy()
  })

  it('says "1re" rather than "1e" when the person won', async () => {
    const ecran = await rendre([ligne(1, { moi: true }), ligne(2)])
    expect(ecran.getByText('1re sur 2')).toBeTruthy()
  })

  it('does not leave someone with no votes without a sentence', async () => {
    const ecran = await rendre([ligne(1), ligne(2, { moi: true, votes: 0 })])
    expect(
      ecran.getByText('Aucune voix cette fois. La semaine prochaine, tu recommences.'),
    ).toBeTruthy()
  })

  it('points someone who did not speak at the week that is open now', async () => {
    const ecran = await rendre([ligne(1), ligne(2)])
    expect(ecran.getByText("Tu n'as pas parlé cette semaine.")).toBeTruthy()
    expect(
      ecran.getByText('Le sujet suivant est déjà ouvert. Prends ta place dedans.'),
    ).toBeTruthy()
  })

  it('lists everyone below the podium under their own heading', async () => {
    const ecran = await rendre([ligne(1), ligne(2), ligne(3), ligne(4), ligne(5)])
    expect(ecran.getByText('Le reste du classement')).toBeTruthy()
    expect(ecran.getByText('Voix 4')).toBeTruthy()
  })

  it('shows no "rest of the ranking" when the week fits on the podium', async () => {
    const ecran = await rendre([ligne(1), ligne(2), ligne(3)])
    expect(ecran.queryByText('Le reste du classement')).toBeNull()
  })

  it('holds a week nobody spoke in', async () => {
    const ecran = await rendre([])
    expect(ecran.getByText("Personne n'a parlé cette semaine.")).toBeTruthy()
  })

  it('says the recordings are gone and the ranking stays (chapter 2)', async () => {
    const ecran = await rendre([ligne(1)])
    expect(
      ecran.getByText('Les enregistrements de la semaine ont été supprimés. Le classement reste.'),
    ).toBeTruthy()
  })
})
