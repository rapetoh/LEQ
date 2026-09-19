import { fireEvent, render } from '@testing-library/react-native'

import Podium from '@/app/arene/podium/[sujetId]'
import { usePodium } from '@/services/arene'
import { FournisseurTheme } from '@/theme/ThemeProvider'

// C8 · What the podium says at the end of a week. The screen holds no arithmetic (that lives in
// services/podiumVue and is tested there); what is checked here is what a person reads.

jest.mock('@/components/BarreEtat', () => ({ useBarreEtatClaire: () => undefined }))
jest.mock('@/services/actualisation', () => ({
  useActualisation: () => ({ enCours: false, actualiser: async () => undefined }),
}))
jest.mock('@/services/photo', () => ({ urlAvatar: () => null }))
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
    nom: `Anonyme ${rang}`,
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
    expect(ecran.getByText('« Faut-il encore apprendre par cœur ? »')).toBeTruthy()
    expect(ecran.getByText('Le podium')).toBeTruthy()
  })

  it('names the three of the podium and counts their votes', async () => {
    const ecran = await rendre([
      ligne(1, { nom: 'Alice', pseudonyme: false }),
      ligne(2, { nom: 'Bob', pseudonyme: false }),
      ligne(3, { nom: 'Chloé', pseudonyme: false }),
    ])
    expect(ecran.getByText('Alice')).toBeTruthy()
    expect(ecran.getByText('Bob')).toBeTruthy()
    expect(ecran.getByText('Chloé')).toBeTruthy()
    expect(ecran.getByText('9 votes')).toBeTruthy()
  })

  it('celebrates the person who carried the week, on the step and in the title', async () => {
    const ecran = await rendre([ligne(1, { moi: true, nom: 'Roch', pseudonyme: false }), ligne(2)])
    expect(ecran.getByText('Tu as gagné la semaine.')).toBeTruthy()
    expect(ecran.getByText('Roch (toi)')).toBeTruthy()
  })

  it('says the week is over when the person did not carry it', async () => {
    const ecran = await rendre([ligne(1), ligne(2, { moi: true })])
    expect(ecran.getByText('La semaine est finie.')).toBeTruthy()
  })

  it('tells the person their place when it is below the podium', async () => {
    const ecran = await rendre([ligne(1), ligne(2), ligne(3), ligne(4, { moi: true }), ligne(5)])
    expect(ecran.getByText('Ta place')).toBeTruthy()
    expect(ecran.getByText('4e sur 5')).toBeTruthy()
    expect(ecran.getByText('6 votes pour toi')).toBeTruthy()
  })

  it('does not leave someone with no votes without a sentence', async () => {
    const ecran = await rendre([ligne(1), ligne(2), ligne(3), ligne(4, { moi: true, votes: 0 })])
    expect(
      ecran.getByText('Aucun vote cette fois. Un nouveau sujet ouvre la semaine prochaine.'),
    ).toBeTruthy()
  })

  it('points someone who did not speak at the week that is open now', async () => {
    const ecran = await rendre([ligne(1), ligne(2)])
    expect(ecran.getByText("Tu n'as pas parlé cette semaine.")).toBeTruthy()
    expect(ecran.getByText('Le sujet suivant est déjà ouvert.')).toBeTruthy()
  })

  it('keeps the rest of the ranking one tap away instead of below the fold', async () => {
    const ecran = await rendre([ligne(1), ligne(2), ligne(3), ligne(4), ligne(5)])
    expect(ecran.getByText('Le reste du classement')).toBeTruthy()
    expect(ecran.queryByText('Anonyme 4')).toBeNull()
    fireEvent.press(ecran.getByText('Le reste du classement'))
    expect(await ecran.findByText('Anonyme 4')).toBeTruthy()
    expect(ecran.getByText('Masquer le classement')).toBeTruthy()
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
      ecran.getByText(
        'Les enregistrements de la semaine ont été supprimés. Le classement est conservé.',
      ),
    ).toBeTruthy()
  })
})
