import type { DuelVue } from '@leq/domaine'
import { render } from '@testing-library/react-native'

import EcranDuel from '@/app/duel/[id]/index'
import { useMesDuels } from '@/services/arene'
import { FournisseurTheme } from '@/theme/ThemeProvider'

// C6 · What a person reads on a duel, state by state. The screen went wrong twice: it offered
// « Écouter sa réponse » on a take the storage refused, and it never said that the other answer
// opens once yours is in. Both are read here.

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }))
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'd1' }),
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
}))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
jest.mock('@/services/actualisation', () => ({
  useActualisation: () => ({ enCours: false, actualiser: async () => undefined }),
}))
jest.mock('@/services/lecture', () => ({
  lecteur: { jouer: jest.fn(), arreter: jest.fn() },
  urlSignee: jest.fn(),
}))
jest.mock('@/services/photo', () => ({ urlAvatar: () => null }))
jest.mock('@/services/profil', () => ({
  useProfil: () => ({ data: { prenom: 'Roch', avatar_chemin: null, publier_sous_prenom: false } }),
}))
jest.mock('@/services/usage', () => ({ compter: jest.fn() }))
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}))
jest.mock('@/services/arene', () => ({
  useMesDuels: jest.fn(),
  creerDuel: jest.fn(),
  invaliderArene: jest.fn(),
  messageRefus: () => 'refus',
}))

const useMesDuelsMock = useMesDuels as unknown as jest.Mock

function cote(a_parle: boolean, extra: Partial<DuelVue['moi']> = {}): DuelVue['moi'] {
  return {
    a_parle,
    prise_id: a_parle ? 'p' : null,
    chemin_audio: null,
    retenue: false,
    duree_s: a_parle ? 69 : null,
    mesures: null,
    ...extra,
  }
}

async function rendre(duel: Partial<DuelVue> = {}) {
  useMesDuelsMock.mockReturnValue({
    data: [
      {
        id: 'd1',
        sujet: 'Est-ce que le silence est une réponse ?',
        statut: 'ouvert',
        verdict: null,
        echeance: new Date(Date.now() + 41.5 * 3_600_000).toISOString(),
        cree_le: new Date().toISOString(),
        clos_le: null,
        duree_max_s: 90,
        role: 'inviteur',
        jeton: 'abc',
        adversaire: { prenom: 'Rebecca', avatar: null },
        moi: cote(false),
        lui: cote(false),
        ...duel,
      },
    ],
    isPending: false,
    isError: false,
    refetch: jest.fn(),
  })
  return render(
    <FournisseurTheme>
      <EcranDuel />
    </FournisseurTheme>,
  )
}

describe('le duel, écran par état', () => {
  it('names the empty seat and offers the invitation while nobody has joined', async () => {
    const ecran = await rendre({ adversaire: null })
    expect(ecran.getByText('Place libre')).toBeTruthy()
    expect(ecran.getByText("Personne n'a encore rejoint le duel.")).toBeTruthy()
    expect(ecran.getByText("Envoyer l'invitation")).toBeTruthy()
  })

  it('closes the other answer until mine is in, on the control itself', async () => {
    const ecran = await rendre({ lui: cote(true, { chemin_audio: null }) })
    expect(ecran.getByText('Après ta réponse')).toBeTruthy()
    expect(ecran.queryByText('Écouter sa réponse')).toBeNull()
    expect(ecran.getByText('À toi de répondre')).toBeTruthy()
    expect(ecran.getByText('Tu entendras la réponse de Rebecca après la tienne.')).toBeTruthy()
  })

  it('says the wait, and its deadline, once I have answered alone', async () => {
    const ecran = await rendre({ moi: cote(true, { chemin_audio: 'a/1.m4a' }) })
    expect(ecran.getByText('Ta réponse est envoyée')).toBeTruthy()
    expect(ecran.getByText('Le verdict arrive dès que Rebecca aura répondu.')).toBeTruthy()
    expect(ecran.getByText('41 h restantes')).toBeTruthy()
    expect(ecran.getByText('Écouter ma réponse')).toBeTruthy()
    expect(ecran.queryByText('Écouter sa réponse')).toBeNull()
  })

  it('plays both answers once the duel is closed, and reads the measures side by side', async () => {
    const ecran = await rendre({
      statut: 'clos',
      verdict: 'inviteur',
      clos_le: new Date().toISOString(),
      moi: cote(true, {
        chemin_audio: 'a/1.m4a',
        mesures: { mots_par_minute: 76, bequilles: 2, silences_tenus: 4 },
      }),
      lui: cote(true, {
        chemin_audio: 'b/2.m4a',
        mesures: { mots_par_minute: 124, bequilles: 1, silences_tenus: 7 },
      }),
    })
    expect(ecran.getByText('Écouter ma réponse')).toBeTruthy()
    expect(ecran.getByText('Écouter sa réponse')).toBeTruthy()
    expect(ecran.getByText('Tu gagnes.')).toBeTruthy()
    expect(ecran.getByText('Vainqueur')).toBeTruthy()
    // The two sides are named once, in the legend; never as a column header over the numbers.
    expect(ecran.getByText('Ce qui se mesure')).toBeTruthy()
    expect(ecran.getByText('76')).toBeTruthy()
    expect(ecran.getByText('124')).toBeTruthy()
    expect(ecran.getByText('mots/min')).toBeTruthy()
  })

  it('says a take nobody may play instead of offering a control that fails', async () => {
    const ecran = await rendre({
      statut: 'clos',
      verdict: 'sans_verdict',
      clos_le: new Date().toISOString(),
      moi: cote(true, { chemin_audio: 'a/1.m4a' }),
      lui: cote(true, { chemin_audio: null, retenue: true }),
    })
    expect(ecran.getByText("Son enregistrement n'est plus disponible.")).toBeTruthy()
    expect(ecran.queryByText('Écouter sa réponse')).toBeNull()
  })

  it('says there is no winner while the grid is not in place, and no verdict is invented', async () => {
    const ecran = await rendre({
      statut: 'clos',
      verdict: 'sans_verdict',
      clos_le: new Date().toISOString(),
      moi: cote(true, { chemin_audio: 'a/1.m4a' }),
      lui: cote(true, { chemin_audio: 'b/2.m4a' }),
    })
    expect(ecran.getByText('Sans verdict')).toBeTruthy()
    expect(
      ecran.getByText(
        "La grille de Rebecca n'est pas encore en place, donc ce duel n'a pas de vainqueur.",
      ),
    ).toBeTruthy()
    expect(ecran.queryByText('Vainqueur')).toBeNull()
    expect(ecran.queryByText('Tu gagnes.')).toBeNull()
  })

  it('says who stayed silent when the duel expired', async () => {
    const ecran = await rendre({
      statut: 'expire',
      clos_le: new Date().toISOString(),
      moi: cote(true, { chemin_audio: 'a/1.m4a' }),
      lui: cote(false),
    })
    expect(ecran.getByText('Le duel a expiré')).toBeTruthy()
    expect(ecran.getByText("Rebecca n'a pas répondu à temps.")).toBeTruthy()
  })
})
