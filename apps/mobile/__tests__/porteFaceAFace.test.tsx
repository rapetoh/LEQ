import type { Debat } from '@leq/domaine'
import { act, fireEvent, render } from '@testing-library/react-native'

import { PorteFaceAFace } from '@/app/(onglets)/arene'
import { useDebatAReprendre, useMesDebats, useQuotaDebats } from '@/services/debat'
import { FournisseurTheme } from '@/theme/ThemeProvider'

// E0 · The door to the face-à-face inside the Arena. It was a pale card, one sentence and a
// button, with two thirds of the screen empty under them. What fills it now is the person's own:
// the sessions left, a session still open, the debates they held. Nothing else.

const mockPush = jest.fn()

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@/services/compte', () => ({
  useEstAnonyme: () => false,
  versCompte: (raison: string) => ({ pathname: '/accueil/compte', params: { raison } }),
}))
jest.mock('@/services/debat', () => ({
  useQuotaDebats: jest.fn(),
  useDebatAReprendre: jest.fn(),
  useMesDebats: jest.fn(),
}))
jest.mock('@/services/arene', () => ({
  useSujet: () => ({ data: null }),
  useClassement: () => ({ data: null }),
  useMaPrise: () => ({ data: null }),
  useMesDuels: () => ({ data: [] }),
  useDernierSujetClos: () => ({ data: null }),
  jourDuSujet: () => 1,
  creerDuel: jest.fn(),
  retirerMaPrise: jest.fn(),
  invaliderArene: jest.fn(),
  messageRefus: () => 'refus',
}))
jest.mock('@/services/configuration', () => ({
  useConfiguration: () => ({ data: {} }),
  useDrapeaux: () => ({ data: { face_a_face: true } }),
}))
jest.mock('@/services/profil', () => ({ useProfil: () => ({ data: null }) }))
jest.mock('@/services/photo', () => ({ urlAvatar: () => null }))
jest.mock('@/services/lecture', () => ({
  lecteur: { jouer: jest.fn(), arreter: jest.fn() },
  urlSignee: jest.fn(),
}))
jest.mock('@/services/actualisation', () => ({
  useActualisation: () => ({ enCours: false, actualiser: async () => undefined }),
}))
jest.mock('@/services/usage', () => ({ compter: jest.fn() }))
jest.mock('@/components/BarreOnglets', () => ({ useEspaceBarreOnglets: () => 0 }))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}))

const useQuotaMock = useQuotaDebats as unknown as jest.Mock
const useRepriseMock = useDebatAReprendre as unknown as jest.Mock
const useMesDebatsMock = useMesDebats as unknown as jest.Mock

function debat(id: string, texte: string, statut: Debat['statut'], secondes: number): Debat {
  return {
    id,
    utilisateur_id: '11111111-1111-4111-8111-111111111111',
    these_id: null,
    these_texte: texte,
    origine_these: 'personnelle',
    ton_adversaire: 'ferme',
    voix_adversaire: 'homme',
    duree_max_s: 180,
    statut,
    issue: statut === 'terminee' ? 'terminee' : null,
    secondes_parlees: secondes,
    commence_le: '2026-09-18T08:00:00Z',
    derniere_activite_le: '2026-09-18T08:10:00Z',
    termine_le: statut === 'terminee' ? '2026-09-18T08:10:00Z' : null,
    debrief: null,
    cree_le: '2026-09-18T08:00:00Z',
    modifie_le: '2026-09-18T08:10:00Z',
  }
}

async function rendre(
  options: {
    restants?: number
    reprise?: Debat | null
    passes?: Debat[]
  } = {},
) {
  useQuotaMock.mockReturnValue({
    data: { formule: 'gratuit', plafond: 3, utilises: 0, restants: options.restants ?? 3 },
  })
  useRepriseMock.mockReturnValue({ data: options.reprise ?? null })
  useMesDebatsMock.mockReturnValue({ data: options.passes ?? [] })
  return render(
    <FournisseurTheme>
      <PorteFaceAFace />
    </FournisseurTheme>,
  )
}

describe('la porte du face-à-face', () => {
  beforeEach(() => jest.clearAllMocks())

  it('présente Rétor et ce qu’il fait', async () => {
    const ecran = await rendre()
    expect(ecran.getByText('Rétor')).toBeTruthy()
    expect(ecran.getByText('Ton contradicteur')).toBeTruthy()
    expect(
      ecran.getByText(
        'Il défend une thèse, tu la contredis. Il répond à ce que tu viens de dire, en direct.',
      ),
    ).toBeTruthy()
    expect(ecran.getByText('Il te reste 3 sessions ce mois-ci.')).toBeTruthy()
  })

  it('explique ce qui va se passer à qui n’a jamais débattu', async () => {
    const ecran = await rendre()
    expect(ecran.getByText('Comment ça se passe')).toBeTruthy()
    expect(
      ecran.getByText('Tu parles autant que tu veux, il répond à ce que tu viens de dire.'),
    ).toBeTruthy()
  })

  it('montre les débats tenus, et arrête d’expliquer', async () => {
    const ecran = await rendre({
      passes: [debat('d1', 'Le mérite est un mythe.', 'terminee', 190)],
    })
    expect(ecran.getByText('Tes face-à-face')).toBeTruthy()
    expect(ecran.getByText('« Le mérite est un mythe. »')).toBeTruthy()
    expect(ecran.getByText('18 septembre · 3 min de parole')).toBeTruthy()
    expect(ecran.queryByText('Comment ça se passe')).toBeNull()
  })

  it('ouvre le débrief du débat qu’on touche', async () => {
    const ecran = await rendre({
      passes: [debat('d1', 'Le mérite est un mythe.', 'terminee', 190)],
    })
    await act(async () => fireEvent.press(ecran.getByText('« Le mérite est un mythe. »')))
    expect(mockPush).toHaveBeenCalledWith('/face-a-face/d1/debrief')
  })

  it('renvoie dans la session ouverte plutôt que d’en proposer une autre', async () => {
    const ouvert = debat('d9', 'Une thèse en cours.', 'ouverte', 40)
    const ecran = await rendre({ reprise: ouvert, passes: [ouvert] })
    await act(async () => fireEvent.press(ecran.getByText('Reprendre le débat')))
    expect(mockPush).toHaveBeenCalledWith('/face-a-face/d9')
    // The open session is not a past debate: it must not be in the list as well.
    expect(ecran.queryByText('« Une thèse en cours. »')).toBeNull()
  })

  it('ne propose pas un débat quand le mois est épuisé', async () => {
    const ecran = await rendre({ restants: 0 })
    expect(ecran.getByText('Tu as utilisé tes sessions du mois.')).toBeTruthy()
    expect(ecran.getByText('Commencer le débat')).toBeDisabled()
  })
})
