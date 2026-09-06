// Single point of contact with @leq/domaine.
// The admin needs the ordered key lists and the per-key validation of the domain package;
// labels and grouping live in this app (fr.ts and pages/configuration/sections.ts).

import {
  CLES_CONFIGURATION,
  CLES_DRAPEAUX,
  estCleConfiguration,
  validerValeurConfiguration,
} from '@leq/domaine'

/** Configuration keys in the order defined by the domain package (used to order rows). */
export const ordreClesConfiguration: readonly string[] = CLES_CONFIGURATION

/** Feature flag keys in the order defined by the domain package. */
export const ordreClesDrapeaux: readonly string[] = CLES_DRAPEAUX

/**
 * Validates a value against the key's own schema when the key is part of the contract
 * (for example a number of points cannot be negative). Unknown keys only get the type check.
 */
export function validerValeurContrat(cle: string, valeur: unknown): string | null {
  if (!estCleConfiguration(cle)) return null
  const resultat = validerValeurConfiguration(cle, valeur)
  if (resultat.success) return null
  return resultat.error.issues.map((probleme) => probleme.message).join(' ')
}
