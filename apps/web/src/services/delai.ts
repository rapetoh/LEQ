// The 48 hours of chapter 11, said the way a person reads a clock. No countdown to the second:
// what matters is whether there is still time, and roughly how much.

export type Reste = { etat: 'heures'; heures: number } | { etat: 'court' } | { etat: 'passe' }

export function resteAvant(echeance: string, maintenant: Date = new Date()): Reste {
  const fin = Date.parse(echeance)
  if (!Number.isFinite(fin)) return { etat: 'passe' }
  const ms = fin - maintenant.getTime()
  if (ms <= 0) return { etat: 'passe' }
  const heures = Math.floor(ms / 3_600_000)
  return heures >= 1 ? { etat: 'heures', heures } : { etat: 'court' }
}
