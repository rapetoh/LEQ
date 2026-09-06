import { fireEvent, render } from '@testing-library/react-native'

import { CarteDuJour } from '@/app/(onglets)/aujourdhui'
import { useEtapeDuJour } from '@/services/parcours'
import { FournisseurTheme } from '@/theme/ThemeProvider'

// The card of the day in its states, from the JSON of etape_du_jour().

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}))
jest.mock('@/services/parcours', () => ({ useEtapeDuJour: jest.fn() }))
jest.mock('@/services/rebecca', () => ({ useAteliers: jest.fn(() => ({ data: undefined })) }))
jest.mock('@/services/progres', () => ({
  useSerie: jest.fn(() => ({ data: undefined })),
  usePoints: jest.fn(() => ({ data: undefined })),
}))
// The screen module also imports the flags hook, whose client needs the environment.
jest.mock('@/services/configuration', () => ({ useDrapeaux: jest.fn(() => ({ data: undefined })) }))

const useEtapeDuJourMock = useEtapeDuJour as jest.Mock

const DONNEES = {
  formule: 'gratuit',
  rythme: {
    jour: '2026-09-06',
    fuseau_horaire: 'Europe/Paris',
    etapes_validees_aujourdhui: 0,
    essais_aujourdhui: 0,
    limite_etapes: 1,
    limite_essais: 3,
    peut_enregistrer: true,
    raison: 'ok',
  },
  etape: {
    id: 'e3',
    ordre_global: 3,
    ordre: 3,
    statut: 'disponible',
    nombre_echecs: 0,
    rattrapage_propose: false,
    seuil_reussite: 18,
    nb_etapes_acte: 5,
  },
  acte: { id: 'a2', ordre: 2, titre: 'Tenir sa ligne', sous_titre: 'Les crêtes du rythme' },
  defi: {
    id: 'd3',
    cle: 'trois_phrases',
    format: 'standard',
    titre: 'Convaincs-moi en trois phrases',
    consigne: '...',
    focus: 'tes silences',
    plan: [],
    texte_a_lire: null,
    duree_lecture_s: null,
    duree_preparation_s: null,
    duree_max_s: 120,
    points: 25,
    competence: 'silences',
    provisoire: true,
  },
}

async function rendre(data: unknown, etat: Partial<{ isPending: boolean; isError: boolean }> = {}) {
  useEtapeDuJourMock.mockReturnValue({
    data,
    isPending: false,
    isError: false,
    refetch: jest.fn(),
    ...etat,
  })
  return render(
    <FournisseurTheme>
      <CarteDuJour />
    </FournisseurTheme>,
  )
}

beforeEach(() => mockPush.mockClear())

describe('CarteDuJour', () => {
  it('shows the step of the day and opens its brief', async () => {
    const ecran = await rendre(DONNEES)
    expect(ecran.getByText('Ton défi du jour · 2 min')).toBeTruthy()
    expect(ecran.getByText('+25 pts')).toBeTruthy()
    expect(ecran.getByText('Convaincs-moi en trois phrases')).toBeTruthy()
    expect(ecran.getByText('Acte II · Les crêtes du rythme · 3 sur 5')).toBeTruthy()
    expect(ecran.getByText('Formule Gratuit · un défi par jour')).toBeTruthy()
    fireEvent.press(ecran.getByText('Je me lance'))
    expect(mockPush).toHaveBeenCalledWith('/defi/e3')
  })

  it('opens the short exercise first when it is proposed', async () => {
    const ecran = await rendre({
      ...DONNEES,
      etape: { ...DONNEES.etape, nombre_echecs: 2, rattrapage_propose: true },
    })
    fireEvent.press(ecran.getByText('Je me lance'))
    expect(mockPush).toHaveBeenCalledWith('/defi/e3/rattrapage')
  })

  it('tells the day is done on the free rhythm, with the door to Complet', async () => {
    const ecran = await rendre({
      ...DONNEES,
      rythme: {
        ...DONNEES.rythme,
        etapes_validees_aujourdhui: 1,
        peut_enregistrer: false,
        raison: 'limite_jour',
      },
    })
    expect(ecran.getByText('Ton défi du jour est fait.')).toBeTruthy()
    expect(ecran.queryByText('Je me lance')).toBeNull()
    fireEvent.press(ecran.getByText('Enchaîner ›'))
    expect(mockPush).toHaveBeenCalledWith('/defi/limite')
  })

  it('says the path is being prepared when there is no step', async () => {
    const ecran = await rendre({
      ...DONNEES,
      rythme: { ...DONNEES.rythme, peut_enregistrer: false, raison: 'aucune_etape' },
      etape: null,
      acte: null,
      defi: null,
    })
    expect(ecran.getByText('Ton chemin se prépare.')).toBeTruthy()
  })

  it('offers a retry when the step cannot be loaded', async () => {
    const ecran = await rendre(undefined, { isError: true })
    expect(ecran.getByText('Réessayer')).toBeTruthy()
  })
})
