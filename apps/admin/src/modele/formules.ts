// Pure model of the tiers Rebecca edits (docs/DATA-MODEL.md, `formules`). No I/O here.
//
// A tier is a row: what it gives per day, per month, per debate, whether it opens the
// community, and which store product sells it. A third tier is one more row (meeting of
// 12 September 2026). Prices are not here: they live in the stores.
import { FORMULE_PAR_DEFAUT, FormuleDetailSchema, type FormuleDetail } from '@leq/domaine'
import type { CodeErreur, Erreurs, ResultatValidation } from './defis'

export type { FormuleDetail }
export { FORMULE_PAR_DEFAUT }

export type SaisieFormule = {
  cle: string
  nom: string
  ordre: string
  etapes_par_jour: string
  debats_par_mois: string
  duree_debat_s: string
  acces_communaute: boolean
  produit_store: string
  actif: boolean
}

export function saisieFormuleVierge(ordre: number): SaisieFormule {
  return {
    cle: '',
    nom: '',
    ordre: String(ordre),
    etapes_par_jour: '0',
    debats_par_mois: '0',
    duree_debat_s: '180',
    acces_communaute: false,
    produit_store: '',
    actif: true,
  }
}

export function saisieDepuisFormule(f: FormuleDetail): SaisieFormule {
  return {
    cle: f.cle,
    nom: f.nom,
    ordre: String(f.ordre),
    etapes_par_jour: String(f.etapes_par_jour),
    debats_par_mois: String(f.debats_par_mois),
    duree_debat_s: String(f.duree_debat_s),
    acces_communaute: f.acces_communaute,
    produit_store: f.produit_store ?? '',
    actif: f.actif,
  }
}

const CLE = /^[a-z0-9_]+$/

/** The key, written from the name: lower case, no accents, underscores. */
export function cleDepuisNom(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
}

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

/** Zero means "no limit" for the steps and "none" for the debates; the speaking time is never zero. */
export function validerFormule(saisie: SaisieFormule): ResultatValidation<FormuleDetail> {
  const erreurs: Erreurs = {}
  const cle = saisie.cle.trim()
  if (cle === '') erreurs.cle = 'requis'
  else if (!CLE.test(cle)) erreurs.cle = 'cle'
  if (saisie.nom.trim() === '') erreurs.nom = 'requis'
  const ordre = entier(saisie.ordre, 1)
  if (!ordre.ok) erreurs.ordre = ordre.code
  const etapes = entier(saisie.etapes_par_jour, 0)
  if (!etapes.ok) erreurs.etapes_par_jour = etapes.code
  const debats = entier(saisie.debats_par_mois, 0)
  if (!debats.ok) erreurs.debats_par_mois = debats.code
  const duree = entier(saisie.duree_debat_s, 1)
  if (!duree.ok) erreurs.duree_debat_s = duree.code
  if (!ordre.ok || !etapes.ok || !debats.ok || !duree.ok || Object.keys(erreurs).length > 0) {
    return { ok: false, erreurs }
  }
  const lu = FormuleDetailSchema.safeParse({
    cle,
    nom: saisie.nom.trim(),
    ordre: ordre.valeur,
    etapes_par_jour: etapes.valeur,
    debats_par_mois: debats.valeur,
    duree_debat_s: duree.valeur,
    acces_communaute: saisie.acces_communaute,
    produit_store: saisie.produit_store.trim() || null,
    actif: saisie.actif,
  })
  if (!lu.success) {
    for (const probleme of lu.error.issues)
      erreurs[String(probleme.path[0] ?? 'contrat')] = 'contrat'
    return { ok: false, erreurs }
  }
  return { ok: true, valeur: lu.data }
}

export function prochainOrdreFormule(formules: readonly FormuleDetail[]): number {
  return formules.reduce((max, f) => Math.max(max, f.ordre), 0) + 1
}
