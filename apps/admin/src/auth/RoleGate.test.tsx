import { render, screen } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { RoleGate } from './RoleGate'
import { SessionContext, type EtatSession } from './sessionContext'

function jeton(charge: Record<string, unknown>): string {
  const encoder = (objet: Record<string, unknown>) =>
    btoa(JSON.stringify(objet)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${encoder({ alg: 'HS256', typ: 'JWT' })}.${encoder(charge)}.signature`
}

function session(role: string | null): Session {
  return {
    access_token: jeton(role ? { app_metadata: { role } } : {}),
    refresh_token: 'r',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: '0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f',
      email: 'rebecca@example.com',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2026-09-06T00:00:00Z',
    },
  } as unknown as Session
}

function rendre(etat: Partial<EtatSession>) {
  const valeur: EtatSession = {
    statut: 'pret',
    session: null,
    deconnecter: vi.fn(() => Promise.resolve()),
    ...etat,
  }
  return render(
    <SessionContext.Provider value={valeur}>
      <RoleGate>
        <p>Contenu réservé</p>
      </RoleGate>
    </SessionContext.Provider>,
  )
}

describe('RoleGate', () => {
  it('renders the children for the admin role carried by the token', () => {
    rendre({ session: session('admin') })
    expect(screen.getByText('Contenu réservé')).toBeInTheDocument()
  })

  it('refuses a plain user and offers to sign out', () => {
    rendre({ session: session('utilisateur') })
    expect(screen.queryByText('Contenu réservé')).not.toBeInTheDocument()
    expect(screen.getByText('Cet espace est réservé à Rebecca.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Se déconnecter' })).toBeInTheDocument()
  })

  it('refuses a token without a role', () => {
    rendre({ session: session(null) })
    expect(screen.queryByText('Contenu réservé')).not.toBeInTheDocument()
  })

  it('shows a waiting state while the session loads', () => {
    rendre({ statut: 'chargement' })
    expect(screen.getByRole('status')).toHaveTextContent('Vérification de ta session.')
  })
})
