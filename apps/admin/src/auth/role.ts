// Reads the role of a session.
//
// The custom access token hook (docs/DATA-MODEL.md, "Roles and helpers") copies profils.role into
// the JWT claim app_metadata.role. RLS reads that claim, so the JWT is the source of truth.
// session.user.app_metadata comes from the user record (auth.users.raw_app_meta_data), which the
// hook does not touch; it is read second so that a role set there directly is honoured too.
// This gate is a convenience for the interface: the real guard is RLS on the server.

import type { Session } from '@supabase/supabase-js'
import { z } from 'zod'

const ChargeJetonSchema = z.object({
  app_metadata: z.object({ role: z.string().optional() }).optional(),
})

function decoderBase64Url(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/')
  const complement = '='.repeat((4 - (base64.length % 4)) % 4)
  const octets = Uint8Array.from(atob(base64 + complement), (caractere) => caractere.charCodeAt(0))
  return new TextDecoder().decode(octets)
}

/** Decodes the payload of a JWT without verifying it (verification is the server's job). */
export function decoderChargeJeton(jeton: string): unknown {
  const segments = jeton.split('.')
  const charge = segments[1]
  if (segments.length < 2 || !charge) return null
  try {
    return JSON.parse(decoderBase64Url(charge)) as unknown
  } catch {
    return null
  }
}

export function roleDeSession(session: Session | null): string | null {
  if (!session) return null

  const charge = ChargeJetonSchema.safeParse(decoderChargeJeton(session.access_token))
  const roleJeton = charge.success ? charge.data.app_metadata?.role : undefined
  if (typeof roleJeton === 'string' && roleJeton.length > 0) return roleJeton

  const roleUtilisateur: unknown = session.user.app_metadata['role']
  return typeof roleUtilisateur === 'string' && roleUtilisateur.length > 0 ? roleUtilisateur : null
}

export function estAdmin(session: Session | null): boolean {
  return roleDeSession(session) === 'admin'
}
