import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fr } from '../fr'
import { Duel } from './Duel'

const lireInvitation = vi.fn()
const lireMonDuel = vi.fn()

vi.mock('../services/duel', () => ({
  lireInvitation: (jeton: string) => lireInvitation(jeton) as unknown,
  rejoindre: vi.fn(),
  envoyerPrise: vi.fn(),
  lireStatutTentative: vi.fn(),
  publier: vi.fn(),
  lireIssue: vi.fn(),
  lireMonDuel: (duelId: string) => lireMonDuel(duelId) as unknown,
  urlSignee: (chemin: string) => Promise.resolve(`https://signee.test/${chemin}`),
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
  beforeEach(() => {
    lireInvitation.mockReset()
    lireMonDuel.mockReset()
  })

  it('names the person who sent the invitation', async () => {
    lireInvitation.mockResolvedValue({ ...INVITATION, inviteur_prenom: 'Roch' })
    afficher()

    expect(await screen.findByText('Roch te défie.')).toBeInTheDocument()
  })

  it('shows a returning invitee the verdict, with both takes to hear', async () => {
    lireInvitation.mockResolvedValue({
      ...INVITATION,
      statut: 'clos',
      deja_repondu: true,
      c_est_moi: true,
      inviteur_prenom: 'Roch',
    })
    lireMonDuel.mockResolvedValue({
      id: INVITATION.id,
      sujet: INVITATION.sujet,
      statut: 'clos',
      verdict: 'invite',
      echeance: DANS_DEUX_JOURS,
      cree_le: DANS_DEUX_JOURS,
      clos_le: DANS_DEUX_JOURS,
      duree_max_s: 90,
      role: 'invite',
      jeton: null,
      adversaire: { prenom: 'Roch', avatar: null },
      moi: { a_parle: true, prise_id: 'p1', chemin_audio: 'a/1.m4a', duree_s: 58, mesures: null },
      lui: { a_parle: true, prise_id: 'p2', chemin_audio: 'b/2.m4a', duree_s: 61, mesures: null },
    })
    afficher()

    expect(await screen.findByText(fr.duel.gagne)).toBeInTheDocument()
    expect(screen.getByText('Duel contre Roch')).toBeInTheDocument()
    expect(await screen.findByLabelText('La réponse de Roch')).toBeInTheDocument()
    expect(screen.getByLabelText(fr.duel.maReponse)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: fr.duel.commencer })).not.toBeInTheDocument()
  })

  it('says the truth about a duel the grid cannot judge yet', async () => {
    lireInvitation.mockResolvedValue({
      ...INVITATION,
      statut: 'clos',
      deja_repondu: true,
      c_est_moi: true,
    })
    lireMonDuel.mockResolvedValue({
      id: INVITATION.id,
      sujet: INVITATION.sujet,
      statut: 'clos',
      verdict: 'sans_verdict',
      echeance: DANS_DEUX_JOURS,
      cree_le: DANS_DEUX_JOURS,
      clos_le: DANS_DEUX_JOURS,
      duree_max_s: 90,
      role: 'invite',
      jeton: null,
      adversaire: { prenom: null, avatar: null },
      moi: { a_parle: true, prise_id: 'p1', chemin_audio: null, duree_s: null, mesures: null },
      lui: { a_parle: true, prise_id: 'p2', chemin_audio: null, duree_s: null, mesures: null },
    })
    afficher()

    // The sentence carries a no-break space, which the matcher's normaliser would flatten.
    expect(await screen.findByText(/n'a pas de verdict/)).toBeInTheDocument()
    expect(document.querySelector('audio')).toBeNull()
  })

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
