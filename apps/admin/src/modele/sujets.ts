// Pure model of the Arena subject form (docs/DATA-MODEL.md, `sujets_arene`). No I/O.
import { SujetAreneEditableSchema, type SujetArene, type SujetAreneEditable } from '@leq/domaine'
import type { CodeErreur, Erreurs, ResultatValidation } from './defis'

export type SaisieSujet = {
  cle: string
  texte: string
  consigne: string
  ordre: string
  duree_max_s: string
  /** The day this subject takes over, `YYYY-MM-DD`. Empty: it follows the order. */
  prevu_le: string
  provisoire: boolean
  actif: boolean
}

export function saisieSujetVierge(ordre: number): SaisieSujet {
  return {
    cle: '',
    texte: '',
    consigne: '',
    ordre: String(ordre),
    duree_max_s: '90',
    prevu_le: '',
    provisoire: true,
    actif: true,
  }
}

export function saisieDepuisSujet(sujet: SujetArene): SaisieSujet {
  return {
    cle: sujet.cle,
    texte: sujet.texte,
    consigne: sujet.consigne ?? '',
    ordre: String(sujet.ordre),
    duree_max_s: String(sujet.duree_max_s),
    prevu_le: sujet.prevu_le ?? '',
    provisoire: sujet.provisoire,
    actif: sujet.actif,
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

export function validerSujet(saisie: SaisieSujet): ResultatValidation<SujetAreneEditable> {
  const erreurs: Erreurs = {}
  const cle = saisie.cle.trim()
  if (cle === '') erreurs.cle = 'requis'
  else if (!CLE.test(cle)) erreurs.cle = 'cle'
  if (saisie.texte.trim() === '') erreurs.texte = 'requis'
  const ordre = entier(saisie.ordre, 1)
  if (!ordre.ok) erreurs.ordre = ordre.code
  const duree = entier(saisie.duree_max_s, 1)
  if (!duree.ok) erreurs.duree_max_s = duree.code
  const prevu = saisie.prevu_le.trim()
  if (prevu !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(prevu)) erreurs.prevu_le = 'date'
  if (Object.keys(erreurs).length > 0 || !ordre.ok || !duree.ok) return { ok: false, erreurs }

  const lu = SujetAreneEditableSchema.safeParse({
    cle,
    texte: saisie.texte.trim(),
    consigne: saisie.consigne.trim() || null,
    ordre: ordre.valeur,
    duree_max_s: duree.valeur,
    prevu_le: prevu === '' ? null : prevu,
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

export function prochainOrdreSujet(sujets: readonly SujetArene[]): number {
  return sujets.reduce((max, s) => Math.max(max, s.ordre), 0) + 1
}

export type EtatSujet = 'passe' | 'en_cours' | 'a_venir' | 'inactif'

/** Where a subject stands in the rotation, for the list. */
export function etatSujet(sujet: SujetArene, maintenant = new Date()): EtatSujet {
  if (!sujet.actif) return 'inactif'
  if (sujet.ferme_le && Date.parse(sujet.ferme_le) <= maintenant.getTime()) return 'passe'
  if (sujet.actif_le && Date.parse(sujet.actif_le) <= maintenant.getTime()) return 'en_cours'
  return 'a_venir'
}
