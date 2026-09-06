/**
 * Table `drapeaux`: feature flags. Shipped off.
 */
import { z } from 'zod'
import { IsoTimestampSchema, UuidSchema } from './primitives.js'

export const CLES_DRAPEAUX = ['arene', 'duels', 'face_a_face'] as const
export const CleDrapeauSchema = z.enum(CLES_DRAPEAUX)
export type CleDrapeau = z.infer<typeof CleDrapeauSchema>

export function estCleDrapeau(cle: string): cle is CleDrapeau {
  return (CLES_DRAPEAUX as readonly string[]).includes(cle)
}

/** A row of `drapeaux` as read back from the database. */
export const DrapeauSchema = z.object({
  cle: CleDrapeauSchema,
  actif: z.boolean(),
  modifie_par: UuidSchema.nullable(),
  cree_le: IsoTimestampSchema,
  modifie_le: IsoTimestampSchema,
})
export type Drapeau = z.output<typeof DrapeauSchema>

/** What the admin sends when a flag is switched. */
export const MiseAJourDrapeauSchema = z.object({
  cle: CleDrapeauSchema,
  actif: z.boolean(),
})
export type MiseAJourDrapeau = z.infer<typeof MiseAJourDrapeauSchema>

export type Drapeaux = Readonly<Record<CleDrapeau, boolean>>

export const DRAPEAUX_PAR_DEFAUT: Drapeaux = {
  arene: false,
  duels: false,
  face_a_face: false,
}

const LigneLueSchema = z.object({
  cle: z.string(),
  actif: z.boolean(),
})

/**
 * Reads the rows of `drapeaux` into a typed object. A missing or malformed row
 * leaves the flag off; an unknown key is ignored. Never throws.
 */
export function lireDrapeaux(rows: ReadonlyArray<unknown>): Drapeaux {
  const drapeaux: Record<CleDrapeau, boolean> = { ...DRAPEAUX_PAR_DEFAUT }
  for (const row of rows) {
    const ligne = LigneLueSchema.safeParse(row)
    if (!ligne.success || !estCleDrapeau(ligne.data.cle)) continue
    drapeaux[ligne.data.cle] = ligne.data.actif
  }
  return drapeaux
}
