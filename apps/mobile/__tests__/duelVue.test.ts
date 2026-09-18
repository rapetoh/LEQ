import type { DuelVue } from '@leq/domaine'

import { dureeCourte, resteAvant, texteReste } from '@/services/delai'
import {
  attentionDuel,
  badgeDuel,
  duelAMettreEnAvant,
  ligneEtat,
  nomAdversaire,
} from '@/services/duelVue'

jest.mock('@/services/supabase', () => ({ supabase: {}, useSession: jest.fn() }))

// What a duel row says, in every state a person can find it in.

const MAINTENANT = new Date('2026-09-18T10:00:00Z')

function cote(a_parle: boolean, extra: Partial<DuelVue['moi']> = {}): DuelVue['moi'] {
  return {
    a_parle,
    prise_id: a_parle ? 'p' : null,
    chemin_audio: null,
    retenue: false,
    duree_s: null,
    mesures: null,
    ...extra,
  }
}

function duel(extra: Partial<DuelVue> = {}): DuelVue {
  return {
    id: 'd1',
    sujet: 'Le silence est-il une réponse ?',
    statut: 'ouvert',
    verdict: null,
    echeance: '2026-09-20T03:30:00Z',
    cree_le: '2026-09-18T03:30:00Z',
    clos_le: null,
    duree_max_s: 90,
    role: 'inviteur',
    jeton: 'abc',
    adversaire: { prenom: 'Rebecca', avatar: null },
    moi: cote(false),
    lui: cote(false),
    ...extra,
  }
}

describe('the time left', () => {
  it('counts whole hours, then the last hour, then the past', () => {
    expect(resteAvant('2026-09-20T03:30:00Z', MAINTENANT)).toEqual({ etat: 'heures', heures: 41 })
    expect(texteReste('2026-09-20T03:30:00Z', MAINTENANT)).toBe('41 h restantes')
    expect(texteReste('2026-09-18T10:30:00Z', MAINTENANT)).toBe("Moins d'une heure")
    expect(texteReste('2026-09-18T09:00:00Z', MAINTENANT)).toBe('Délai passé')
  })

  it('writes a length as a clock reads it', () => {
    expect(dureeCourte(58)).toBe('0:58')
    expect(dureeCourte(62.4)).toBe('1:02')
    expect(dureeCourte(null)).toBeNull()
  })
})

describe('the line under a duel', () => {
  it('names the other side, or says nobody is in it', () => {
    expect(nomAdversaire(duel())).toBe('Rebecca')
    expect(nomAdversaire(duel({ adversaire: { prenom: null, avatar: null } }))).toBe(
      'Ton adversaire',
    )
  })

  it('wears the end of a duel as a badge, so the line never says « Terminé » twice', () => {
    expect(badgeDuel(duel())).toBeNull()
    expect(badgeDuel(duel({ statut: 'clos' }))).toBe('termine')
    expect(badgeDuel(duel({ statut: 'expire' }))).toBe('expire')
  })

  it('says whose turn it is while the duel is open, with the time left', () => {
    expect(ligneEtat(duel({ adversaire: null }), MAINTENANT)).toBe(
      "Personne n'a encore rejoint · 41 h restantes",
    )
    expect(ligneEtat(duel(), MAINTENANT)).toBe('À toi de répondre · 41 h restantes')
    expect(ligneEtat(duel({ lui: cote(true) }), MAINTENANT)).toBe(
      'Rebecca a répondu · à ton tour · 41 h restantes',
    )
    expect(ligneEtat(duel({ moi: cote(true) }), MAINTENANT)).toBe(
      'En attente de Rebecca · 41 h restantes',
    )
  })

  it('says how it ended, from this side, with no « Terminé » the badge already carries', () => {
    const clos = {
      statut: 'clos' as const,
      moi: cote(true),
      lui: cote(true),
      clos_le: '2026-09-18T09:00:00Z',
    }
    expect(ligneEtat(duel({ ...clos, verdict: 'inviteur' }), MAINTENANT)).toBe('Tu gagnes')
    expect(ligneEtat(duel({ ...clos, verdict: 'invite' }), MAINTENANT)).toBe('Rebecca gagne')
    expect(ligneEtat(duel({ ...clos, verdict: 'inviteur', role: 'invite' }), MAINTENANT)).toBe(
      'Rebecca gagne',
    )
    expect(ligneEtat(duel({ ...clos, verdict: 'egalite' }), MAINTENANT)).toBe('Égalité')
    expect(ligneEtat(duel({ ...clos, verdict: 'sans_verdict' }), MAINTENANT)).toBe('Sans verdict')
    expect(ligneEtat(duel({ statut: 'expire' }), MAINTENANT)).toBe("Personne n'a répondu à temps")
  })
})

describe('what the home points at', () => {
  it('a turn to take first, then a fresh verdict, never an old one', () => {
    const aToi = duel({ id: 'a', lui: cote(true) })
    const attente = duel({ id: 'b', moi: cote(true) })
    const recent = duel({
      id: 'c',
      statut: 'clos',
      verdict: 'sans_verdict',
      clos_le: '2026-09-18T09:00:00Z',
    })
    const vieux = duel({
      id: 'd',
      statut: 'clos',
      verdict: 'inviteur',
      clos_le: '2026-09-10T09:00:00Z',
    })
    expect(attentionDuel(aToi, MAINTENANT)).toBe('a_toi')
    expect(attentionDuel(attente, MAINTENANT)).toBeNull()
    expect(attentionDuel(recent, MAINTENANT)).toBe('verdict')
    expect(attentionDuel(vieux, MAINTENANT)).toBeNull()
    expect(duelAMettreEnAvant([vieux, recent, attente, aToi], MAINTENANT)).toEqual({
      duel: aToi,
      attention: 'a_toi',
    })
    expect(duelAMettreEnAvant([vieux, recent, attente], MAINTENANT)).toEqual({
      duel: recent,
      attention: 'verdict',
    })
    expect(duelAMettreEnAvant([vieux, attente], MAINTENANT)).toBeNull()
  })
})
