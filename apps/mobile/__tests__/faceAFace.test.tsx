import type { MessageSortant } from '@leq/domaine'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'

import FaceAFace from '@/app/face-a-face/[debatId]'
import { FournisseurTheme } from '@/theme/ThemeProvider'

// E3 · What a person reads during a face-à-face, message by message.
//
// The screen used to guess whose turn it was, and it guessed wrong: the provider ended a turn on
// a 700 ms pause and nothing said so, so it told someone to keep speaking into a microphone the
// server had stopped listening to. Every state below is driven by the server's own messages.

const mockEnvoyes: Array<Record<string, unknown>> = []
let mockRecevoir: ((message: MessageSortant) => void) | null = null

const mockAudio = {
  demarrer: jest.fn(async () => undefined),
  arreter: jest.fn(async () => undefined),
  ecouter: jest.fn(),
  jouer: jest.fn(),
  taire: jest.fn(),
  resteAJouerMs: jest.fn(() => 0),
}

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ debatId: 'd1' }),
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
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
jest.mock('@/services/usage', () => ({ compter: jest.fn() }))
jest.mock('@/services/micro', () => ({ lireEtatMicro: async () => 'accorde' }))
jest.mock('@/services/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'j' } } }) } },
}))
jest.mock('@/services/debatAudio', () => ({
  AudioDebat: jest.fn().mockImplementation(() => mockAudio),
}))
jest.mock('@/services/debat', () => ({
  invaliderDebats: jest.fn(),
  ClientDebat: jest.fn().mockImplementation((surMessage: (m: MessageSortant) => void) => {
    mockRecevoir = surMessage
    return {
      ouvrir: jest.fn(),
      envoyer: (message: Record<string, unknown>) => mockEnvoyes.push(message),
      fermer: jest.fn(),
    }
  }),
}))

const PRET: MessageSortant = {
  type: 'pret',
  version: 2,
  debat_id: 'd1',
  these: 'Le télétravail a tué la vie de bureau.',
  ton: 'ferme',
  duree_max_s: 180,
  secondes_parlees: 0,
  tours: [],
  silence_fin_tour_ms: 2200,
  provisoire: false,
}

async function ouvrir(...messages: MessageSortant[]) {
  mockEnvoyes.length = 0
  const ecran = render(
    <FournisseurTheme>
      <FaceAFace />
    </FournisseurTheme>,
  )
  await waitFor(() => expect(mockRecevoir).not.toBeNull())
  await act(async () => {
    for (const message of [PRET, ...messages]) mockRecevoir?.(message)
  })
  return ecran
}

describe("l'écran du face-à-face", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRecevoir = null
  })

  it('attend la parole du serveur avant de dire à la personne de parler', async () => {
    const ecran = await ouvrir()
    expect(ecran.queryByText("Je t'écoute")).toBeNull()
    await act(async () => mockRecevoir?.({ type: 'a_toi' }))
    expect(ecran.getByText("Je t'écoute")).toBeTruthy()
    expect(mockAudio.ecouter).toHaveBeenLastCalledWith(true)
  })

  it('montre la thèse que Rétor défend', async () => {
    const ecran = await ouvrir({ type: 'a_toi' })
    expect(ecran.getByText('Rétor défend')).toBeTruthy()
    expect(ecran.getByText('« Le télétravail a tué la vie de bureau. »')).toBeTruthy()
  })

  it('garde la parole à la personne tant qu’elle ne dit pas qu’elle a fini', async () => {
    const ecran = await ouvrir({ type: 'a_toi' })
    expect(ecran.getByText("Je t'écoute")).toBeTruthy()
    // Nothing on this screen counts against a silence: the server only starts a countdown when
    // the person asked for hands free, and it is off.
    expect(ecran.getByText('Mains libres')).toBeTruthy()
    expect(mockEnvoyes.some((m) => m.type === 'mains_libres')).toBe(false)
  })

  it('demande les mains libres au serveur quand la personne les allume', async () => {
    const ecran = await ouvrir({ type: 'a_toi' })
    await act(async () => fireEvent.press(ecran.getByText('Mains libres')))
    expect(mockEnvoyes.at(-1)).toEqual({ type: 'mains_libres', actif: true })
    expect(ecran.getByLabelText('Mains libres').props.accessibilityState).toMatchObject({
      checked: true,
    })
    await act(async () => fireEvent.press(ecran.getByText('Mains libres')))
    expect(mockEnvoyes.at(-1)).toEqual({ type: 'mains_libres', actif: false })
  })

  it('dit que le silence va donner la parole, sans la donner', async () => {
    const ecran = await ouvrir({ type: 'a_toi' })
    await act(async () => mockRecevoir?.({ type: 'parole', actif: false }))
    expect(ecran.getByText('Rétor va répondre')).toBeTruthy()
    // The floor has not moved: the person can still take it back with one word.
    expect(ecran.getByText("J'ai fini")).toBeTruthy()
    await act(async () => mockRecevoir?.({ type: 'parole', actif: true }))
    expect(ecran.getByText("Je t'écoute")).toBeTruthy()
  })

  it('coupe le micro dès que le serveur donne la parole à Rétor', async () => {
    const ecran = await ouvrir({ type: 'a_toi' })
    await act(async () => mockRecevoir?.({ type: 'a_retor', raison: 'silence' }))
    expect(mockAudio.ecouter).toHaveBeenLastCalledWith(false)
    expect(ecran.getByText('Rétor réfléchit')).toBeTruthy()
    expect(ecran.queryByText("J'ai fini")).toBeNull()
  })

  it('dit que le micro a coupé quand le tour a fini comme ça', async () => {
    const ecran = await ouvrir({ type: 'a_toi' })
    await act(async () => mockRecevoir?.({ type: 'a_retor', raison: 'micro' }))
    expect(ecran.getByText("Ton micro a coupé. Rétor répond à ce qu'il a entendu.")).toBeTruthy()
  })

  it('garde dans le fil ce que la personne a dit, et pas seulement Rétor', async () => {
    const ecran = await ouvrir({ type: 'a_toi' })
    await act(async () => {
      mockRecevoir?.({ type: 'transcription', texte: 'Je ne suis pas', partiel: true })
    })
    expect(ecran.getByText('Je ne suis pas')).toBeTruthy()
    await act(async () => {
      mockRecevoir?.({ type: 'a_retor', raison: 'bouton' })
      mockRecevoir?.({ type: 'mon_tour', numero: 1, texte: "Je ne suis pas d'accord du tout." })
      mockRecevoir?.({
        type: 'reponse_texte',
        numero: 2,
        texte: 'Et pourtant les bureaux sont vides.',
      })
    })
    expect(ecran.getByText("Je ne suis pas d'accord du tout.")).toBeTruthy()
    expect(ecran.getByText('Et pourtant les bureaux sont vides.')).toBeTruthy()
  })

  it("offre de couper Rétor pendant qu'il parle, et le fait taire", async () => {
    const ecran = await ouvrir({ type: 'a_toi' })
    await act(async () => {
      mockRecevoir?.({ type: 'a_retor', raison: 'bouton' })
      mockRecevoir?.({ type: 'reponse_texte', numero: 2, texte: 'Les bureaux sont vides.' })
    })
    expect(ecran.getByText('Rétor te répond')).toBeTruthy()
    fireEvent.press(ecran.getByText('Reprendre la parole'))
    expect(mockAudio.taire).toHaveBeenCalled()
    expect(mockEnvoyes.at(-1)).toEqual({ type: 'reprendre_parole' })
  })

  it("passe la parole quand la personne dit qu'elle a fini", async () => {
    const ecran = await ouvrir({ type: 'a_toi' })
    fireEvent.press(ecran.getByText("J'ai fini"))
    expect(mockEnvoyes.at(-1)).toEqual({ type: 'fin_tour', raison: 'bouton' })
    expect(mockAudio.ecouter).toHaveBeenLastCalledWith(false)
  })

  it('rend la parole à la personne quand le serveur la rend', async () => {
    const ecran = await ouvrir({ type: 'a_toi' })
    await act(async () => {
      mockRecevoir?.({ type: 'a_retor', raison: 'silence' })
      mockRecevoir?.({ type: 'reponse_texte', numero: 2, texte: 'Les bureaux sont vides.' })
      mockRecevoir?.({ type: 'a_toi' })
    })
    expect(ecran.getByText("Je t'écoute")).toBeTruthy()
    expect(mockAudio.ecouter).toHaveBeenLastCalledWith(true)
  })

  it('dit que le temps de parole est fini quand c’est ça qui a coupé le tour', async () => {
    const ecran = await ouvrir({ type: 'a_toi' })
    await act(async () => mockRecevoir?.({ type: 'a_retor', raison: 'plafond' }))
    expect(ecran.getByText('Ton temps de parole est écoulé.')).toBeTruthy()
  })

  it('laisse Rétor finir sa phrase avant de reprendre le micro', async () => {
    mockAudio.resteAJouerMs.mockReturnValue(4000)
    const ecran = await ouvrir({ type: 'a_toi' })
    await act(async () => {
      mockRecevoir?.({ type: 'a_retor', raison: 'bouton' })
      mockRecevoir?.({ type: 'reponse_texte', numero: 2, texte: 'Les bureaux sont vides.' })
      mockRecevoir?.({ type: 'a_toi' })
    })
    // The server has finished sending his voice; the phone has four seconds of it left to say.
    expect(ecran.getByText('Rétor te répond')).toBeTruthy()
    expect(mockAudio.taire).not.toHaveBeenCalled()
    expect(mockAudio.ecouter).toHaveBeenLastCalledWith(false)
    mockAudio.resteAJouerMs.mockReturnValue(0)
  })

  it('rend la main tout de suite quand on coupe la fin de sa phrase', async () => {
    mockAudio.resteAJouerMs.mockReturnValue(4000)
    const ecran = await ouvrir({ type: 'a_toi' })
    await act(async () => {
      mockRecevoir?.({ type: 'a_retor', raison: 'bouton' })
      mockRecevoir?.({ type: 'reponse_texte', numero: 2, texte: 'Les bureaux sont vides.' })
      mockRecevoir?.({ type: 'a_toi' })
    })
    // The floor is already the person's on the server's side: asking for it again would be
    // refused, and the screen would wait for an answer that never comes.
    await act(async () => fireEvent.press(ecran.getByText('Reprendre la parole')))
    expect(mockAudio.taire).toHaveBeenCalled()
    expect(mockEnvoyes.some((m) => m.type === 'reprendre_parole')).toBe(false)
    expect(ecran.getByText("Je t'écoute")).toBeTruthy()
    mockAudio.resteAJouerMs.mockReturnValue(0)
  })

  it('dit le temps de parole qui reste', async () => {
    const ecran = await ouvrir({ type: 'a_toi' })
    expect(ecran.getByText('3:00')).toBeTruthy()
    await act(async () => {
      mockRecevoir?.({ type: 'temps', secondes_parlees: 150, secondes_restantes: 30 })
    })
    expect(ecran.getByText('0:30')).toBeTruthy()
  })
})
