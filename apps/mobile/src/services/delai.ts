// The 48 hours of a duel, said the way a person reads a clock: whether there is still time, and
// roughly how much. Written from fr.ts strings: Hermes on iOS has no Intl.RelativeTimeFormat.
import { t } from '@/i18n/fr'

/** The clock, read in one place: a screen stamps the start of a playback with it. */
export function maintenant(): number {
  return Date.now()
}

export type Reste = { etat: 'heures'; heures: number } | { etat: 'court' } | { etat: 'passe' }

export function resteAvant(echeance: string, maintenant: Date = new Date()): Reste {
  const fin = Date.parse(echeance)
  if (!Number.isFinite(fin)) return { etat: 'passe' }
  const ms = fin - maintenant.getTime()
  if (ms <= 0) return { etat: 'passe' }
  const heures = Math.floor(ms / 3_600_000)
  return heures >= 1 ? { etat: 'heures', heures } : { etat: 'court' }
}

/** « 41 h restantes », « Moins d'une heure », « Délai passé ». */
export function texteReste(echeance: string, maintenant: Date = new Date()): string {
  const reste = resteAvant(echeance, maintenant)
  if (reste.etat === 'heures') return t('duel.heuresRestantes', { heures: reste.heures })
  if (reste.etat === 'court') return t('duel.moinsUneHeure')
  return t('duel.delaiPasse')
}

/** « 0:58 » for a take's length; null when the length is unknown. */
export function dureeCourte(secondes: number | null | undefined): string | null {
  if (secondes === null || secondes === undefined || !Number.isFinite(secondes)) return null
  const s = Math.max(0, Math.round(secondes))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
