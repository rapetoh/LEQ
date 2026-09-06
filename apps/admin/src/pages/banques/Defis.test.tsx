import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../composants/Toasts'
import type { Defi, ModeleActe } from '../../modele/defis'
import * as services from '../../services/defis'
import { Defis } from './Defis'

vi.mock('../../services/defis', () => ({
  cleRequeteActes: ['modeles_actes'],
  cleRequeteDefis: ['defis'],
  chargerModelesActes: vi.fn(),
  chargerDefis: vi.fn(),
  echangerOrdreDefis: vi.fn(),
  enregistrerModeleActe: vi.fn(),
}))

const ACTES: ModeleActe[] = [
  { ordre: 1, titre: 'Poser sa voix', sous_titre: null, cree_le: 'x', modifie_le: 'x' },
  {
    ordre: 2,
    titre: 'Tenir sa ligne',
    sous_titre: 'Les crêtes du rythme',
    cree_le: 'x',
    modifie_le: 'x',
  },
]

function defi(surcharges: Partial<Defi>): Defi {
  return {
    id: 'a',
    cle: 'a',
    ordre_acte: 1,
    ordre: 1,
    format: 'standard',
    titre: 'Le premier bonjour',
    consigne: 'c',
    focus: null,
    plan: [],
    texte_a_lire: null,
    duree_lecture_s: null,
    duree_preparation_s: null,
    duree_max_s: 120,
    points: 25,
    competence: 'voix',
    seuil_reussite: 18,
    provisoire: true,
    actif: true,
    cree_le: 'x',
    modifie_le: 'x',
    ...surcharges,
  }
}

const DEFIS = [
  defi({ id: 'a', cle: 'a', ordre: 1 }),
  defi({ id: 'b', cle: 'b', ordre: 2, titre: 'Se présenter', provisoire: false, actif: false }),
  defi({
    id: 'c',
    cle: 'c',
    ordre_acte: 2,
    ordre: 1,
    titre: 'Trois phrases',
    format: 'long',
    duree_max_s: 300,
    points: 50,
  }),
]

function rendre() {
  vi.mocked(services.chargerModelesActes).mockResolvedValue(ACTES)
  vi.mocked(services.chargerDefis).mockResolvedValue(DEFIS)
  vi.mocked(services.echangerOrdreDefis).mockResolvedValue()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter>
          <Defis />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('Defis', () => {
  it('lists the défis under their act with their badges', async () => {
    rendre()
    expect(await screen.findByText('Le premier bonjour')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Poser sa voix' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Tenir sa ligne' })).toBeInTheDocument()
    expect(screen.getByText('Grand format · 5 min · 50 pts · seuil 18 · voix')).toBeInTheDocument()
    expect(screen.getAllByText('Provisoire')).toHaveLength(2)
    expect(screen.getByText('Validé')).toBeInTheDocument()
    expect(screen.getByText('Inactif')).toBeInTheDocument()
    expect(screen.getByText('2 défis')).toBeInTheDocument()
  })

  it('swaps a défi with its neighbour and disables the arrows at the edges', async () => {
    rendre()
    await screen.findByText('Le premier bonjour')
    expect(screen.getByRole('button', { name: 'Monter Le premier bonjour' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Descendre Trois phrases' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Descendre Le premier bonjour' }))
    await waitFor(() => expect(services.echangerOrdreDefis).toHaveBeenCalledWith('a', 'b'))
    expect(await screen.findByText('Ordre modifié.')).toBeInTheDocument()
  })
})
