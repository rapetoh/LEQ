import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fr } from '../fr'
import { Duel } from './Duel'

const lireInvitation = vi.fn()

vi.mock('../services/duel', () => ({
  lireInvitation: (jeton: string) => lireInvitation(jeton) as unknown,
  rejoindre: vi.fn(),
  envoyerPrise: vi.fn(),
  lireStatutTentative: vi.fn(),
  publier: vi.fn(),
  lireIssue: vi.fn(),
  estStatutTentativeFinal: () => true,
  messageRefus: () => ({ titre: fr.duel.erreur, detail: fr.commun.reessayer }),
}))

vi.mock('../services/enregistrement', () => ({
  Enregistreur: class {
    demarrer = vi.fn()
    arreter = vi.fn()
    annuler = vi.fn()
    secondes = () => 0
  },
  ErreurMicro: class extends Error {},
  navigateurSaitEnregistrer: () => true,
}))

function afficher() {
  return render(
    <MemoryRouter initialEntries={['/duel/jeton-de-test']}>
      <Routes>
        <Route path="/duel/:jeton" element={<Duel />} />
      </Routes>
    </MemoryRouter>,
  )
}

const DANS_DEUX_JOURS = new Date(Date.now() + 47 * 3_600_000).toISOString()

const INVITATION = {
  raison: 'ok' as const,
  id: '11111111-1111-4111-8111-111111111111',
  sujet: 'Faut-il interdire la voiture en centre-ville ?',
  statut: 'ouvert' as const,
  duree_max_s: 90,
  echeance: DANS_DEUX_JOURS,
  deja_repondu: false,
}

describe('the duel invitation page', () => {
  beforeEach(() => lireInvitation.mockReset())

  it('shows the subject, the ceiling and the deadline', async () => {
    lireInvitation.mockResolvedValue(INVITATION)
    afficher()

    expect(await screen.findByText(INVITATION.sujet)).toBeInTheDocument()
    expect(screen.getByText('1:30 au maximum')).toBeInTheDocument()
    expect(screen.getByText(/Il te reste/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: fr.duel.commencer })).toBeInTheDocument()
  })

  it('never offers to hear the other take before recording (cahier chapter 11)', async () => {
    lireInvitation.mockResolvedValue(INVITATION)
    afficher()
    await screen.findByText(INVITATION.sujet)

    const boutons = screen.getAllByRole('button').map((bouton) => bouton.textContent ?? '')
    expect(boutons).toEqual([fr.duel.commencer])
    expect(screen.queryByText(/[Éé]couter/)).not.toBeInTheDocument()
    expect(document.querySelector('audio')).toBeNull()
  })

  it('says the verdict is rendered by the analysis, not by Rebecca herself', async () => {
    lireInvitation.mockResolvedValue(INVITATION)
    afficher()

    expect(await screen.findByText(fr.duel.automatique)).toBeInTheDocument()
  })

  it('closes the door on a duel that is over, without offering to record', async () => {
    lireInvitation.mockResolvedValue({ ...INVITATION, statut: 'clos' })
    afficher()

    expect(await screen.findByText(fr.duel.closTitre)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: fr.duel.commencer })).not.toBeInTheDocument()
  })

  it('treats a passed deadline as an expiry even when the row still says open', async () => {
    lireInvitation.mockResolvedValue({
      ...INVITATION,
      echeance: new Date(Date.now() - 60_000).toISOString(),
    })
    afficher()

    expect(await screen.findByText(fr.duel.expireTitre)).toBeInTheDocument()
  })

  it('tells a second visitor that the seat is taken', async () => {
    lireInvitation.mockResolvedValue({ ...INVITATION, deja_repondu: true })
    afficher()

    expect(await screen.findByText(fr.duel.completTitre)).toBeInTheDocument()
  })

  it('explains a link that leads nowhere', async () => {
    lireInvitation.mockResolvedValue({ raison: 'introuvable' })
    afficher()

    expect(await screen.findByText(fr.duel.introuvable)).toBeInTheDocument()
  })
})
