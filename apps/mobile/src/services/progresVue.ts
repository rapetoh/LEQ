// Pure presentation of the progress page (D1, D1b): what the JSON of resume_progres() becomes
// on screen. Tested without React.
import type { ResumeProgres } from '@leq/domaine'

export type EvolutionAppui = { mot: string; avant: number; apres: number }

/**
 * The crutch words over the six weeks: for each of the three most used words, the average per
 * take in the first week that has takes and in the last one. "14 → 5" reads per take.
 */
export function evolutionAppuis(
  semaines: ResumeProgres['bequilles_semaines'],
  maximum = 3,
): EvolutionAppui[] {
  const avecPrises = semaines.filter((s) => s.prises > 0)
  if (avecPrises.length === 0) return []
  const premiere = avecPrises[0]!
  const derniere = avecPrises[avecPrises.length - 1]!
  const totaux = new Map<string, number>()
  for (const semaine of avecPrises) {
    for (const [mot, total] of Object.entries(semaine.par_type)) {
      totaux.set(mot, (totaux.get(mot) ?? 0) + total)
    }
  }
  const parPrise = (semaine: typeof premiere, mot: string) =>
    Math.round((semaine.par_type[mot] ?? 0) / semaine.prises)
  return [...totaux.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maximum)
    .map(([mot]) => ({ mot, avant: parPrise(premiere, mot), apres: parPrise(derniere, mot) }))
}

/** True when the person places fewer crutch words per take than at the start. */
export function moinsDAppuis(evolutions: readonly EvolutionAppui[]): boolean {
  const avant = evolutions.reduce((t, e) => t + e.avant, 0)
  const apres = evolutions.reduce((t, e) => t + e.apres, 0)
  return evolutions.length > 0 && apres < avant
}

export type ZoneDebit = 'pose' | 'zone' | 'presse'

/** The zone that carries is 130 to 150 words a minute (A6 says so to the person). */
export const DEBIT_ZONE_MIN = 130
export const DEBIT_ZONE_MAX = 150

export function zoneDebit(debit: number): ZoneDebit {
  if (debit < DEBIT_ZONE_MIN) return 'pose'
  if (debit > DEBIT_ZONE_MAX) return 'presse'
  return 'zone'
}

/** Where the marker sits on a bar from 80 to 200 words a minute, as a ratio 0..1. */
export function positionDebit(debit: number, min = 80, max = 200): number {
  return Math.min(1, Math.max(0, (debit - min) / (max - min)))
}

const INITIALES = ['D', 'L', 'M', 'M', 'J', 'V', 'S'] as const

/** "L" for a Monday: the initial of the day, from a YYYY-MM-DD string. */
export function initialeJour(jour: string): string {
  const date = new Date(`${jour}T12:00:00Z`)
  return INITIALES[date.getUTCDay()] ?? ''
}

/** "12 juin" for the first take's date; the last one reads through ilYA. */
export function dateCourte(iso: string): string {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return ''
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(date)
}

export function arrondir(valeur: number | null, decimales = 0): string {
  if (valeur === null) return '·'
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: decimales }).format(valeur)
}
