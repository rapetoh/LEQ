// Pure model of a feature flag row (docs/DATA-MODEL.md, table `drapeaux`).

import { z } from 'zod'

export const CLES_DRAPEAUX_CONNUES = ['arene', 'duels', 'face_a_face'] as const
export type CleDrapeau = (typeof CLES_DRAPEAUX_CONNUES)[number]

export function estCleDrapeau(cle: string): cle is CleDrapeau {
  return (CLES_DRAPEAUX_CONNUES as readonly string[]).includes(cle)
}

export const EntreeDrapeauSchema = z.object({
  cle: z.string().min(1),
  actif: z.boolean(),
  modifie_le: z.string().nullable().optional(),
})

export type EntreeDrapeau = {
  cle: string
  actif: boolean
  modifie_le: string | null
}

export function normaliserEntreeDrapeau(brute: z.infer<typeof EntreeDrapeauSchema>): EntreeDrapeau {
  return { cle: brute.cle, actif: brute.actif, modifie_le: brute.modifie_le ?? null }
}
