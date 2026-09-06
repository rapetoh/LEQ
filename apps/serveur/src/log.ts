// Structured JSON logging on stdout (Fly collects it as is).
import { pino, type Logger } from 'pino'
import type { NiveauLog } from './config.js'

export type { Logger }

export function creerLogger(niveau: NiveauLog, base: Record<string, unknown> = {}): Logger {
  return pino({
    level: niveau,
    base: { service: 'leq-serveur', ...base },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
  })
}

/** Message of an unknown thrown value, bounded so it fits in a text column. */
export function messageErreur(erreur: unknown, max = 2000): string {
  const texte =
    erreur instanceof Error
      ? `${erreur.name}: ${erreur.message}`
      : typeof erreur === 'string'
        ? erreur
        : JSON.stringify(erreur)
  return texte.length > max ? `${texte.slice(0, max - 1)}…` : texte
}
