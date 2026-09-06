/**
 * Table `demandes_export`: a request for a copy of one's data, handled by hand.
 */
import { z } from 'zod'
import { IsoTimestampSchema, UuidSchema } from './primitives.js'

export const DemandeExportSchema = z.object({
  id: UuidSchema,
  utilisateur_id: UuidSchema,
  email: z.string().nullable(),
  traitee_le: IsoTimestampSchema.nullable(),
  traitee_par: UuidSchema.nullable(),
  cree_le: IsoTimestampSchema,
  modifie_le: IsoTimestampSchema,
})
export type DemandeExport = z.output<typeof DemandeExportSchema>

export const NouvelleDemandeExportSchema = z.object({
  utilisateur_id: UuidSchema,
  email: z.string().email().nullable().default(null),
})
export type NouvelleDemandeExport = z.output<typeof NouvelleDemandeExportSchema>
