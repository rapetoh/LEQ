import type { These } from '@leq/domaine'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'

import PreparerDebat from '@/app/face-a-face/index'
import { ouvrirDebat, useDebatAReprendre, useQuotaDebats, useTheses } from '@/services/debat'
import { FournisseurTheme } from '@/theme/ThemeProvider'

// E2 · What a person decides before a debate, and what the screen is allowed to claim. Nothing
// on it is invented: no theme on a thesis, no points for a debate, no turn count, because the
// database holds none of those.

const mockPush = jest.fn()
const mockReplace = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: mockPush, replace: mockReplace }),
  useFocusEffect: (effet: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react')
    useEffect(effet, [effet])
  },
}))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}))
jest.mock('@/services/actualisation', () => ({
  useActualisation: () => ({ enCours: false, actualiser: async () => undefined }),
}))
jest.mock('@/services/compte', () => ({
  useEstAnonyme: () => false,
  versCompte: (raison: string) => ({ pathname: '/accueil/compte', params: { raison } }),
}))
jest.mock('@/services/configuration', () => ({
  useConfiguration: () => ({ data: { duree_face_a_face_gratuit_s: 180 } }),
}))
jest.mock('@/services/formules', () => ({
  useFormules: () => ({ data: [{ cle: 'gratuit', nom: 'Gratuit' }] }),
  nomFormule: () => 'Gratuit',
}))
jest.mock('@/services/usage', () => ({ compter: jest.fn() }))
jest.mock('@/services/debat', () => ({
  useTheses: jest.fn(),
  useQuotaDebats: jest.fn(),
  useDebatAReprendre: jest.fn(),
  ouvrirDebat: jest.fn(),
  abandonnerDebat: jest.fn(),
  invaliderDebats: jest.fn(),
  messageRefus: () => 'refus',
  ErreurDebat: class extends Error {},
}))

const useThesesMock = useTheses as unknown as jest.Mock
const useQuotaMock = useQuotaDebats as unknown as jest.Mock
const useRepriseMock = useDebatAReprendre as unknown as jest.Mock
const ouvrirMock = ouvrirDebat as unknown as jest.Mock

function these(id: string, texte: string, ton: These['ton_suggere']): These {
  return {
    id,
    cle: id,
    texte,
    ton_suggere: ton,
    ordre: 1,
    actif: true,
    provisoire: true,
    cree_le: '2026-09-01T00:00:00Z',
    modifie_le: '2026-09-01T00:00:00Z',
  }
}

const BANQUE = [
  these('11111111-1111-4111-8111-111111111111', 'Le télétravail a tué la vie de bureau.', 'ferme'),
  these(
    '22222222-2222-4222-8222-222222222222',
    'On devrait tirer les responsables au sort.',
    'provocateur',
  ),
]

async function rendre(banque: These[] = BANQUE, restants = 3) {
  useThesesMock.mockReturnValue({ data: banque, isPending: false, isError: false })
  useQuotaMock.mockReturnValue({
    data: { formule: 'gratuit', plafond: 3, utilises: 0, restants },
    isPending: false,
    isError: false,
  })
  useRepriseMock.mockReturnValue({ data: null, isPending: false, isError: false })
  ouvrirMock.mockResolvedValue({ id: 'd1' })
  // `render` is asynchronous in this version of the library: not awaiting it hands back a
  // promise, and every query on it fails with « render function has not been called ».
  return render(
    <FournisseurTheme>
      <PreparerDebat />
    </FournisseurTheme>,
  )
}

describe('préparer un face-à-face', () => {
  beforeEach(() => jest.clearAllMocks())

  it('montre une thèse en entier, et qui va la défendre', async () => {
    const ecran = await rendre()
    expect(ecran.getByText('« Le télétravail a tué la vie de bureau. »')).toBeTruthy()
    expect(ecran.getByText("La thèse qu'il va défendre")).toBeTruthy()
    expect(ecran.getByText('Rétor')).toBeTruthy()
  })

  it('en propose une autre, sans jamais en montrer deux à la fois', async () => {
    const ecran = await rendre()
    await act(async () => fireEvent.press(ecran.getByText('Une autre')))
    expect(ecran.getByText('« On devrait tirer les responsables au sort. »')).toBeTruthy()
    expect(ecran.queryByText('« Le télétravail a tué la vie de bureau. »')).toBeNull()
  })

  it('dit ce que chaque ton change, dans les mots envoyés à Rétor', async () => {
    const ecran = await rendre()
    expect(
      ecran.getByText('Il contredit sans détour, sans jamais manquer de respect.'),
    ).toBeTruthy()
    await act(async () => fireEvent.press(ecran.getByText('Académique')))
    expect(ecran.getByText('Il demande des définitions et distingue les notions.')).toBeTruthy()
  })

  it('part sur le ton que Rebecca a mis sur la thèse, jusqu’à ce que la personne en choisisse un', async () => {
    const ecran = await rendre()
    await act(async () => fireEvent.press(ecran.getByText('Une autre'))) // celle-ci est « provocateur »
    expect(ecran.getByText('Il cherche la faille et ne lâche pas un point faible.')).toBeTruthy()
    await act(async () => fireEvent.press(ecran.getByText('Commencer le débat')))
    expect(ouvrirMock).toHaveBeenCalledWith(
      expect.objectContaining({ ton: 'provocateur', voix: 'homme' }),
    )
  })

  it('emporte la voix choisie', async () => {
    const ecran = await rendre()
    await act(async () => fireEvent.press(ecran.getByText('Une femme')))
    await act(async () => fireEvent.press(ecran.getByText('Commencer le débat')))
    expect(ouvrirMock).toHaveBeenCalledWith(expect.objectContaining({ voix: 'femme' }))
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/face-a-face/d1'))
  })

  it('laisse écrire sa propre thèse, et revenir à la banque', async () => {
    const ecran = await rendre()
    await act(async () => fireEvent.press(ecran.getByText('Écrire la mienne')))
    expect(
      ecran.getByPlaceholderText('Une phrase affirmative, que tu vas contredire.'),
    ).toBeTruthy()
    await act(async () => fireEvent.press(ecran.getByText('Choisir dans la banque')))
    expect(ecran.getByText('« Le télétravail a tué la vie de bureau. »')).toBeTruthy()
  })

  it('ouvre sur le champ quand la banque de Rebecca est vide', async () => {
    const ecran = await rendre([])
    expect(
      ecran.getByPlaceholderText('Une phrase affirmative, que tu vas contredire.'),
    ).toBeTruthy()
    expect(ecran.queryByText('Une autre')).toBeNull()
  })

  it('dit le temps de parole et la formule, et ce que la session coûte au mois', async () => {
    const ecran = await rendre(BANQUE, 3)
    expect(ecran.getByText('3 min de parole pour toi, formule Gratuit.')).toBeTruthy()
    expect(ecran.getByText('3 sessions')).toBeTruthy()
  })

  it('ne promet pas un débat quand il ne reste aucune session', async () => {
    const ecran = await rendre(BANQUE, 0)
    expect(ecran.getByText('Tu as utilisé tes sessions du mois.')).toBeTruthy()
    expect(ecran.getByText('Aucune session')).toBeTruthy()
  })

  it("ne montre ni points, ni nombre de tours, ni thème : rien de tout ça n'existe", async () => {
    const ecran = await rendre()
    expect(ecran.queryByText(/points/i)).toBeNull()
    expect(ecran.queryByText(/tours/i)).toBeNull()
    expect(ecran.queryByText(/thème/i)).toBeNull()
  })
})
