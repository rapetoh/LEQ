// Pure model of the shop Rebecca edits (docs/DATA-MODEL.md, `recompenses`) and of the exchanges
// she honours. No I/O here.
import {
  NOMS_TYPE_RECOMPENSE,
  RecompenseEditableSchema,
  TYPES_RECOMPENSE,
  type EchangeRecompense,
  type Recompense,
  type RecompenseEditable,
  type StatutEchange,
  type TypeRecompense,
} from '@leq/domaine'
import type { CodeErreur, Erreurs, ResultatValidation } from './defis'

export { NOMS_TYPE_RECOMPENSE, TYPES_RECOMPENSE }
export type { EchangeRecompense, Recompense, RecompenseEditable, StatutEchange, TypeRecompense }

export type SaisieRecompense = {
  cle: string
  ordre: string
  type: TypeRecompense
  titre: string
  sous_titre: string
  description: string
  cout_points: string
  plafond_par_mois: string
  echangeable: boolean
  provisoire: boolean
  actif: boolean
}

export function saisieRecompenseVierge(ordre: number): SaisieRecompense {
  return {
    cle: '',
    ordre: String(ordre),
    type: 'contenu',
    titre: '',
    sous_titre: '',
    description: '',
    cout_points: '',
    plafond_par_mois: '',
    echangeable: true,
    provisoire: true,
    actif: true,
  }
}

export function saisieDepuisRecompense(r: Recompense): SaisieRecompense {
  return {
    cle: r.cle,
    ordre: String(r.ordre),
    type: r.type,
    titre: r.titre,
    sous_titre: r.sous_titre ?? '',
    description: r.description ?? '',
    cout_points: r.cout_points === null ? '' : String(r.cout_points),
    plafond_par_mois: r.plafond_par_mois === null ? '' : String(r.plafond_par_mois),
    echangeable: r.echangeable,
    provisoire: r.provisoire,
    actif: r.actif,
  }
}

const CLE = /^[a-z0-9_]+$/

function entier(
  texte: string,
  requis: boolean,
  minimum: number,
): { ok: true; valeur: number | null } | { ok: false; code: CodeErreur } {
  const propre = texte.trim().replace(',', '.')
  if (propre === '') return requis ? { ok: false, code: 'requis' } : { ok: true, valeur: null }
  const n = Number(propre)
  if (!Number.isFinite(n)) return { ok: false, code: 'nombre' }
  if (!Number.isInteger(n)) return { ok: false, code: 'entier' }
  if (n < minimum) return { ok: false, code: 'positif' }
  return { ok: true, valeur: n }
}

/** A distinction never buys: it has no cost and is not exchangeable. Everything else costs points. */
export function validerRecompense(
  saisie: SaisieRecompense,
): ResultatValidation<RecompenseEditable> {
  const erreurs: Erreurs = {}
  const cle = saisie.cle.trim()
  if (cle === '') erreurs.cle = 'requis'
  else if (!CLE.test(cle)) erreurs.cle = 'cle'
  if (saisie.titre.trim() === '') erreurs.titre = 'requis'
  const distinction = saisie.type === 'distinction'
  const echangeable = distinction ? false : saisie.echangeable
  const ordre = entier(saisie.ordre, true, 1)
  if (!ordre.ok) erreurs.ordre = ordre.code
  // A distinction has neither cost nor cap: whatever the hidden fields hold is dropped, not validated.
  const cout = distinction
    ? { ok: true as const, valeur: null }
    : entier(saisie.cout_points, echangeable, 1)
  if (!cout.ok) erreurs.cout_points = cout.code
  const plafond = distinction
    ? { ok: true as const, valeur: null }
    : entier(saisie.plafond_par_mois, false, 1)
  if (!plafond.ok) erreurs.plafond_par_mois = plafond.code
  if (Object.keys(erreurs).length > 0 || !ordre.ok || !cout.ok || !plafond.ok)
    return { ok: false, erreurs }

  const lu = RecompenseEditableSchema.safeParse({
    cle,
    ordre: ordre.valeur,
    type: saisie.type,
    titre: saisie.titre.trim(),
    sous_titre: saisie.sous_titre.trim() || null,
    description: saisie.description.trim() || null,
    cout_points: cout.valeur,
    plafond_par_mois: plafond.valeur,
    echangeable,
    provisoire: saisie.provisoire,
    actif: saisie.actif,
  })
  if (!lu.success) {
    for (const probleme of lu.error.issues)
      erreurs[String(probleme.path[0] ?? 'contrat')] = 'contrat'
    return { ok: false, erreurs }
  }
  return { ok: true, valeur: lu.data }
}

export function prochainOrdreRecompense(recompenses: readonly Recompense[]): number {
  return recompenses.reduce((max, r) => Math.max(max, r.ordre), 0) + 1
}
