// Pure model of the thesis form (docs/DATA-MODEL.md, `theses`). No I/O.
//
// The bank matters more than it looks: chapter 10 says most people asked to invent a debate
// subject freeze or pick something they cannot defend, and the session is lost before it has
// started. What Rebecca writes here is what the app offers first.
import { TheseEditableSchema, TONS_ADVERSAIRE, type These, type TheseEditable } from '@leq/domaine'

import type { CodeErreur, Erreurs, ResultatValidation } from './defis'

export type SaisieThese = {
  cle: string
  texte: string
  ton_suggere: string
  ordre: string
  provisoire: boolean
  actif: boolean
}

export function saisieTheseVierge(ordre: number): SaisieThese {
  return {
    cle: '',
    texte: '',
    ton_suggere: 'ferme',
    ordre: String(ordre),
    provisoire: true,
    actif: true,
  }
}

export function saisieDepuisThese(these: These): SaisieThese {
  return {
    cle: these.cle,
    texte: these.texte,
    ton_suggere: these.ton_suggere,
    ordre: String(these.ordre),
    provisoire: these.provisoire,
    actif: these.actif,
  }
}

const CLE = /^[a-z0-9_]+$/

function entier(
  texte: string,
  minimum: number,
): { ok: true; valeur: number } | { ok: false; code: CodeErreur } {
  const propre = texte.trim().replace(',', '.')
  if (propre === '') return { ok: false, code: 'requis' }
  const n = Number(propre)
  if (!Number.isFinite(n)) return { ok: false, code: 'nombre' }
  if (!Number.isInteger(n)) return { ok: false, code: 'entier' }
  if (n < minimum) return { ok: false, code: 'positif' }
  return { ok: true, valeur: n }
}

export function validerThese(saisie: SaisieThese): ResultatValidation<TheseEditable> {
  const erreurs: Erreurs = {}
  const cle = saisie.cle.trim()
  if (cle === '') erreurs.cle = 'requis'
  else if (!CLE.test(cle)) erreurs.cle = 'cle'
  if (saisie.texte.trim() === '') erreurs.texte = 'requis'
  if (!(TONS_ADVERSAIRE as readonly string[]).includes(saisie.ton_suggere)) {
    erreurs.ton_suggere = 'contrat'
  }
  const ordre = entier(saisie.ordre, 1)
  if (!ordre.ok) erreurs.ordre = ordre.code
  if (Object.keys(erreurs).length > 0 || !ordre.ok) return { ok: false, erreurs }

  const lu = TheseEditableSchema.safeParse({
    cle,
    texte: saisie.texte.trim(),
    ton_suggere: saisie.ton_suggere,
    ordre: ordre.valeur,
    provisoire: saisie.provisoire,
    actif: saisie.actif,
  })
  if (!lu.success) {
    for (const probleme of lu.error.issues) {
      erreurs[String(probleme.path[0] ?? 'contrat')] = 'contrat'
    }
    return { ok: false, erreurs }
  }
  return { ok: true, valeur: lu.data }
}

export function prochainOrdreThese(theses: readonly These[]): number {
  return theses.reduce((max, these) => Math.max(max, these.ordre), 0) + 1
}

/**
 * The theses the app would offer right now, in order. Shown in the list so Rebecca sees what
 * a person actually gets rather than guessing from the order column.
 */
export function proposeesMaintenant(theses: readonly These[], nombre = 3): These[] {
  return theses
    .filter((these) => these.actif)
    .slice()
    .sort((a, b) => a.ordre - b.ordre)
    .slice(0, nombre)
}
