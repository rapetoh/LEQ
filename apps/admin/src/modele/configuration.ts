// Pure model of a configuration row (docs/DATA-MODEL.md, table `configuration`).
// No I/O here so that the row editor and its tests never touch Supabase.

import { z } from 'zod'

export const TYPES_CONFIGURATION = ['nombre', 'texte', 'booleen', 'json'] as const
export type TypeConfiguration = (typeof TYPES_CONFIGURATION)[number]

/** Shape of a row as returned by the database, validated at the service boundary. */
export const EntreeConfigurationSchema = z.object({
  cle: z.string().min(1),
  valeur: z.unknown(),
  type: z.enum(TYPES_CONFIGURATION),
  description: z.string(),
  modifie_le: z.string().nullable().optional(),
})

export type EntreeConfiguration = {
  cle: string
  valeur: unknown
  type: TypeConfiguration
  description: string
  modifie_le: string | null
}

export function normaliserEntreeConfiguration(
  brute: z.infer<typeof EntreeConfigurationSchema>,
): EntreeConfiguration {
  return {
    cle: brute.cle,
    valeur: brute.valeur,
    type: brute.type,
    description: brute.description,
    modifie_le: brute.modifie_le ?? null,
  }
}

/** Unit hint derived from the key suffix, shown next to number fields. */
export function uniteDeCle(cle: string): string | null {
  if (cle.endsWith('_s')) return 's'
  if (cle.endsWith('_minutes')) return 'min'
  if (cle.endsWith('_heures')) return 'h'
  if (cle.endsWith('_jours')) return 'j'
  if (cle.endsWith('_par_mois')) return '/ mois'
  if (cle.endsWith('_par_jour')) return '/ jour'
  return null
}
