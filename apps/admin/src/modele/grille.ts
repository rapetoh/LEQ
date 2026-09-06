// Pure model of the grid editor (docs/DATA-MODEL.md, `grilles` and `criteres_grille`):
// what the form holds as text and how it becomes a rule v1 the engine understands. No I/O.
import {
  CHEMINS_MESURES_V1,
  CleCritereSchema,
  RegleCritereV1Schema,
  type CritereGrille,
  type RegleCritereV1,
} from '@leq/domaine'
import type { CodeErreur, Erreurs, ResultatValidation } from './defis'

export { CHEMINS_MESURES_V1 }
export type { CritereGrille, RegleCritereV1 }

export type SaisieBande = { min: string; max: string; score: string }
export type SaisieElement = { mesure: string; poids: string; bandes: SaisieBande[] }
export type SaisieCritere = {
  cle: string
  nom: string
  definition: string
  score_max: string
  elements: SaisieElement[]
}

export type CritereEditable = {
  cle: string
  nom: string
  definition: string
  regle: RegleCritereV1
  ordre: number
}

export function bandeVierge(): SaisieBande {
  return { min: '', max: '', score: '' }
}

export function elementVierge(): SaisieElement {
  return { mesure: CHEMINS_MESURES_V1[3], poids: '1', bandes: [bandeVierge()] }
}

export function saisieCritereVierge(): SaisieCritere {
  return { cle: '', nom: '', definition: '', score_max: '10', elements: [elementVierge()] }
}

export function saisieDepuisCritere(critere: CritereGrille): SaisieCritere {
  const regle = critere.regle
  return {
    cle: critere.cle,
    nom: critere.nom,
    definition: critere.definition,
    score_max: texte(regle.score_max),
    elements: regle.elements.map((e) => ({
      mesure: e.mesure,
      poids: texte(e.poids),
      bandes: e.bandes.map((b) => ({
        min: b.min === null ? '' : texte(b.min),
        max: b.max === null ? '' : texte(b.max),
        score: texte(b.score),
      })),
    })),
  }
}

function texte(n: number): string {
  return String(n).replace('.', ',')
}

type Nombre = { ok: true; valeur: number | null } | { ok: false; code: CodeErreur }

function nombre(t: string, requis: boolean, minimum: number | null): Nombre {
  const propre = t.trim().replace(',', '.')
  if (propre === '') return requis ? { ok: false, code: 'requis' } : { ok: true, valeur: null }
  const n = Number(propre)
  if (!Number.isFinite(n)) return { ok: false, code: 'nombre' }
  if (minimum !== null && n < minimum) return { ok: false, code: 'positif' }
  return { ok: true, valeur: n }
}

/**
 * Field errors are keyed by path: `cle`, `score_max`, `elements.0.mesure`,
 * `elements.0.bandes.1.max`, so the form shows each one next to its field.
 */
export function validerCritere(
  saisie: SaisieCritere,
  ordre: number,
): ResultatValidation<CritereEditable> {
  const erreurs: Erreurs = {}
  const cle = saisie.cle.trim()
  if (cle === '') erreurs.cle = 'requis'
  else if (!CleCritereSchema.safeParse(cle).success) erreurs.cle = 'cle'
  if (saisie.nom.trim() === '') erreurs.nom = 'requis'
  if (saisie.definition.trim() === '') erreurs.definition = 'requis'
  const scoreMax = nombre(saisie.score_max, true, 0)
  if (!scoreMax.ok) erreurs.score_max = scoreMax.code
  else if ((scoreMax.valeur ?? 0) <= 0) erreurs.score_max = 'positif'
  if (saisie.elements.length === 0) erreurs.elements = 'requis'

  const elements = saisie.elements.map((element, i) => {
    const mesure = element.mesure.trim()
    if (mesure === '') erreurs[`elements.${i}.mesure`] = 'requis'
    const poids = nombre(element.poids, true, 0)
    if (!poids.ok) erreurs[`elements.${i}.poids`] = poids.code
    else if ((poids.valeur ?? 0) <= 0) erreurs[`elements.${i}.poids`] = 'positif'
    if (element.bandes.length === 0) erreurs[`elements.${i}.bandes`] = 'requis'
    const bandes = element.bandes.map((bande, j) => {
      const min = nombre(bande.min, false, null)
      const max = nombre(bande.max, false, null)
      const score = nombre(bande.score, true, 0)
      if (!min.ok) erreurs[`elements.${i}.bandes.${j}.min`] = min.code
      if (!max.ok) erreurs[`elements.${i}.bandes.${j}.max`] = max.code
      if (!score.ok) erreurs[`elements.${i}.bandes.${j}.score`] = score.code
      if (
        min.ok &&
        max.ok &&
        min.valeur !== null &&
        max.valeur !== null &&
        min.valeur > max.valeur
      ) {
        erreurs[`elements.${i}.bandes.${j}.max`] = 'bande'
      }
      return {
        min: min.ok ? min.valeur : null,
        max: max.ok ? max.valeur : null,
        score: score.ok ? (score.valeur ?? 0) : 0,
      }
    })
    return { mesure, bandes, poids: poids.ok ? (poids.valeur ?? 1) : 1 }
  })

  if (Object.keys(erreurs).length > 0) return { ok: false, erreurs }
  const regle = RegleCritereV1Schema.safeParse({
    version: 1,
    score_max: scoreMax.ok ? scoreMax.valeur : 0,
    elements,
  })
  if (!regle.success) {
    for (const probleme of regle.error.issues)
      erreurs[probleme.path.join('.') || 'contrat'] = 'contrat'
    return { ok: false, erreurs }
  }
  return {
    ok: true,
    valeur: {
      cle,
      nom: saisie.nom.trim(),
      definition: saisie.definition.trim(),
      regle: regle.data,
      ordre,
    },
  }
}

/** The measure paths offered by the select; a per-word crutch count is typed by hand. */
export const PREFIXE_PAR_TYPE = 'mots_bequilles.par_type.'
export function estCheminConnu(chemin: string): boolean {
  return (
    (CHEMINS_MESURES_V1 as readonly string[]).includes(chemin) ||
    chemin.startsWith(PREFIXE_PAR_TYPE)
  )
}
